/**
 * @author bhouston / http://clara.io/
 *
 * Scalable Ambient Occlusion
 *
 */

THREE.ShaderChunk['sao'] = [

"#include <packing>",

"float getDepth( const in vec2 screenPosition ) {",

	"#if DEPTH_PACKING == 1",
		"return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );",
	"#else",
		"return texture2D( tDepth, screenPosition ).x;",
	"#endif",

"}",

"vec4 setDepth( const in float depth ) {",

	"#if DEPTH_PACKING == 1",
		"return packDepthToRGBA( depth );",
	"#else",
		"return vec4( depth, 0, 0, 0 );",
	"#endif",

"}",

"float getViewZ( const in float depth ) {",

	"#if PERSPECTIVE_CAMERA == 1",
		"return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
	"#else",
		"return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",
	"#endif",

"}"

].join( "\n" );

THREE.SAOShader = {

	blending: THREE.NoBlending,

	defines: {
//		'NUM_SAMPLES': 9,
//		'NUM_RINGS': 7,
		'NUM_SAMPLES': 63,
		'NUM_RINGS': 13,
		"NORMAL_TEXTURE": 0,
		"DIFFUSE_TEXTURE": 1,
		"DEPTH_PACKING": 1,
		"PERSPECTIVE_CAMERA": 1
	},

	extensions: {
		'derivatives': true
	},

	uniforms: {

		"tDepth":       { type: "t", value: null },
		"tDepth1":       { type: "t", value: null },
		"tDepth2":       { type: "t", value: null },
		"tDepth3":       { type: "t", value: null },

		"tDiffuse":     { type: "t", value: null },
		"tNormal":      { type: "t", value: null },
		"size":         { type: "v2", value: new THREE.Vector2( 512, 512 ) },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 },
		"cameraProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { type: "m4", value: new THREE.Matrix4() },

		"intensity":    { type: "f", value: 0.1 },

		"occlusionSphereWorldRadius": { type: "f", value: 100.0 },
		"worldToScreenRatio": { type: "v2", value: new THREE.Vector2( 1, 1 ) },
		"randomSeed":   { type: "f", value: 0.0 }
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [


		"#include <common>",

		"varying vec2 vUv;",

		"#if DIFFUSE_TEXTURE == 1",
			"uniform sampler2D tDiffuse;",
		"#endif",

		"#define MAX_MIP_LEVEL 3",

		"uniform sampler2D tDepth;",
		"uniform sampler2D tDepth1;",
		"uniform sampler2D tDepth2;",
		"uniform sampler2D tDepth3;",

		"#if NORMAL_TEXTURE == 1",
			"uniform sampler2D tNormal;",
		"#endif",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform mat4 cameraProjectionMatrix;",
		"uniform mat4 cameraInverseProjectionMatrix;",

		"uniform float intensity;",
		"uniform float occlusionSphereWorldRadius;",
		"uniform vec2 size;",
		"uniform vec2 worldToScreenRatio;",
		"uniform float randomSeed;",


		"#include <sao>",

		"vec4 getDefaultColor( const in vec2 screenPosition ) {",

			"#if DIFFUSE_TEXTURE == 1",
				"return texture2D( tDiffuse, vUv );",
			"#else",
				"return vec4( 1.0 );",
			"#endif",

		"}",

		"vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

			"float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",
			"vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",
			"clipPosition *= clipW;", // unprojection.
			"return ( cameraInverseProjectionMatrix * clipPosition ).xyz;",

		"}",

		"vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {",

			"#if NORMAL_TEXTURE == 1",
				"return -unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );",
			"#else",
				"return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );",
			"#endif",

		"}",

		"float getDepthMIP( const in vec2 screenPosition, const int mipLevel ) {",

			"vec4 rawDepth;",
			"if( mipLevel == 0 ) {",
				"rawDepth = texture2D( tDepth, screenPosition );",
			"}",
			"else if( mipLevel == 1 ) {",
				"rawDepth = texture2D( tDepth1, screenPosition );",
			"}",
			"else if( mipLevel == 2 ) {",
				"rawDepth = texture2D( tDepth2, screenPosition );",
			"}",
			"else {",
				"rawDepth = texture2D( tDepth3, screenPosition );",
			"}",

			"#if DEPTH_PACKING == 1",
				"return unpackRGBAToDepth( rawDepth );",
			"#else",
				"return rawDepth.x;",
			"#endif",

		"}",

		"float scaleDividedByCameraFar;",
		"float minResolutionMultipliedByCameraFar;",
	
		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			//"if( length( viewDelta ) == 0.0 ) return 0.0;",
			"vec3 viewDirection = normalize( viewDelta );",
			"float viewDistance2 = dot( viewDelta, viewDelta );",			
		
			"return max( dot( centerViewNormal, normalize( viewDelta ) ), 0.0 ) * smoothstep( occlusionSphereWorldRadius, 0.0, sqrt( viewDistance2 ) );",
			//"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			//"float viewDistance2 = dot( viewDelta, viewDelta );",
			//"return max( ( dot( centerViewNormal, viewDelta ) + centerViewPosition.z * 0.001 ) / ( viewDistance2 + 0.0001 ), 0.0 ) * smoothstep( pow2( occlusionSphereWorldRadius ), 0.0, viewDistance2 );",

		"}",

		/*
		"float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {",

			"vec3 viewDelta = sampleViewPosition - centerViewPosition;",
			"float viewDistance2 = dot( viewDelta, viewDelta );",

			"return max( pow3( pow2( occlusionSphereWorldRadius ) - viewDistance2 ), 0.0 ) *",
				"max( ( dot( centerViewNormal, viewDelta ) - 0.01 * occlusionSphereWorldRadius ) / ( viewDistance2 + 0.0001 ), 0.0 );",

		"}",*/

		//"const float maximumScreenRadius = 10.0;",

		"int getMipLevel( const in vec2 occlusionSphereScreenRadius ) {",
    	"return int( clamp( floor( log2( length( occlusionSphereScreenRadius * size ) ) - 4.0 ), 0.0, 3.0 ) );",
		"}",

		// moving costly divides into consts
		"const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );",
		"const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );",

		"float getAmbientOcclusion( const in vec3 centerViewPosition ) {",

			// precompute some variables require in getOcclusion.
			"vec3 centerViewNormal = getViewNormal( centerViewPosition, vUv );",

			"vec2 occlusionSphereScreenRadius = occlusionSphereWorldRadius * worldToScreenRatio / centerViewPosition.z;",
			//"vec2 occlusionSphereScreenRadius = min( occlusionSphereWorldRadius * worldToScreenRatio / centerViewPosition.z, min( - cameraNear - centerViewPosition.z , cameraFar + centerViewPosition.z ) );",
			// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
			"float angle = rand( vUv + randomSeed ) * PI2;",
			"float radiusStep = INV_NUM_SAMPLES;",
			"float radius = radiusStep * 0.5;",

			"float occlusionSum = 0.0;",
			
			"for( int i = 0; i < NUM_SAMPLES; i ++ ) {",
				"vec2 sampleUvOffset = vec2( cos( angle ), sin( angle ) ) * radius * occlusionSphereScreenRadius * 1.0;",
				"radius += radiusStep;",
				"angle += ANGLE_STEP;",
				
				"vec2 sampleUv = vUv + sampleUvOffset;",


				"if( sampleUv.x <= 0.0 || sampleUv.y <= 0.0 || sampleUv.x >= 1.0 || sampleUv.y >= 1.0 ) continue;", // skip points outside of texture.

				"int depthMipLevel = 0;//getMipLevel( radius * occlusionSphereScreenRadius );",
				"float sampleDepth = getDepthMIP( sampleUv, depthMipLevel );",
				"if( sampleDepth >= ( 1.0 - EPSILON ) ) {",
					"continue;",
				"}",

				"float sampleViewZ = getViewZ( sampleDepth );",
				"vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );",
				"occlusionSum += getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );",

			"}",

		//	"float diameterLengthPerSample = ( 2.0 * occlusionSphereWorldRadius ) / float( NUM_SAMPLES );",
		//	"float diskAreaPerSample = PI * pow2( occlusionSphereWorldRadius ) / float( NUM_SAMPLES );",
		//	"float sphereVolumePerSample = PI * pow3( occlusionSphereWorldRadius ) / float( NUM_SAMPLES );",
			"return occlusionSum * intensity;",
			//"return occlusionSum * intensity * 5.0 / ( float( NUM_SAMPLES ) * pow( occlusionSphereWorldRadius, 6.0 ) );",

		"}",


		"void main() {",

			"float centerDepth = getDepth( vUv );",
			"if( centerDepth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

			"float centerViewZ = getViewZ( centerDepth );",
			"vec3 viewPosition = getViewPosition( vUv, centerDepth, centerViewZ );",

			"float ambientOcclusion = getAmbientOcclusion( viewPosition );",

			"gl_FragColor = getDefaultColor( vUv );",
			"gl_FragColor.xyz *= max( 1.0 - ambientOcclusion, 0.0 );",

		"}"

	].join( "\n" )

};

// source: http://g3d.cs.williams.edu/websvn/filedetails.php?repname=g3d&path=%2FG3D10%2Fdata-files%2Fshader%2FAmbientOcclusion%2FAmbientOcclusion_minify.pix
THREE.SAODepthMinifyShader = {

	blending: THREE.NoBlending,

	defines: {
	//	"DEPTH_PACKING": 1,
	//	"JITTERED_SAMPLING": 1
	},

	uniforms: {

		"tDepth":	{ type: "t", value: null },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [


		"#include <common>",

		"varying vec2 vUv;",

		"uniform sampler2D tDepth;",
		"uniform vec2 size;",

		"vec2 round( const in vec2 a ) { return floor( a + 0.5 ); }",

		"void main() {",

/*		g3d_FragColor.mask = texelFetch(
			CSZ_buffer,
			clamp(
				ssP * 2 + ivec2(ssP.y & 1, ssP.x & 1),
				ivec2(0),
				textureSize(CSZ_buffer, previousMIPNumber) - ivec2(1)),
			previousMIPNumber).mask;

	 }*/

	 		"vec2 uv = vUv;",

		//	"uv += ( round( vec2( rand( vUv * size ), rand( vUv * size + vec2( 0.333, 2.0 ) ) ) ) - 0.5 ) / size;",

			// NOTE: no need for depth decoding if nearest interpolation is used.
			"gl_FragColor = texture2D( tDepth, vUv );",

		"}"

	].join( "\n" )

};

THREE.SAOBilaterialFilterShader = {

	blending: THREE.NoBlending,

	defines: {
		"DEPTH_PACKING": 1,
		"PERSPECTIVE_CAMERA": 1,
		"KERNEL_SAMPLE_RADIUS": 12,
	},

	uniforms: {

		"tAO":	{ type: "t", value: null },
		"tDepth":	{ type: "t", value: null },
		"size": { type: "v2", value: new THREE.Vector2( 256, 256 ) },

		"kernelDirection": { type: "v2", value: new THREE.Vector2( 1, 0 ) },
		"occlusionSphereWorldRadius": { type: "f", value: 50 },

		"cameraNear":   { type: "f", value: 1 },
		"cameraFar":    { type: "f", value: 100 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#include <common>",

		"varying vec2 vUv;",

		"uniform sampler2D tAO;",
		"uniform sampler2D tDepth;",
		"uniform vec2 size;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",

		"uniform float occlusionSphereWorldRadius;",
		"uniform vec2 kernelDirection;",

		"#include <sao>",

		"float getKernelWeight( const in int i ) {",

			"return smoothstep( float( KERNEL_SAMPLE_RADIUS ) + 1.0, 0.0, float( i ) );",

		"}",

		"void addTapInfluence( const in vec2 tapUv, const in float centerViewZ, const in float sampleWeight, inout float aoSum, inout float tapWeight, inout float weightSum ) {",
		
			"float depth = getDepth( tapUv );",

			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"return;",
			"}",

			"float tapViewZ = -getViewZ( depth );",
			"tapWeight *= smoothstep( occlusionSphereWorldRadius, 0.0, abs( tapViewZ - centerViewZ ) );",

			"aoSum += texture2D( tAO, tapUv ).r * tapWeight * sampleWeight;",
			"weightSum += tapWeight * sampleWeight;",

		"}",

		"void main() {",

			"float depth = getDepth( vUv );",
			"if( depth >= ( 1.0 - EPSILON ) ) {",
				"discard;",
			"}",

			"float centerViewZ = -getViewZ( depth );",

			"float weightSum = getKernelWeight( 0 );",
			"float aoSum = texture2D( tAO, vUv ).r;",

			"vec2 uvIncrement = ( kernelDirection / size ) * 2.0;",

			"vec2 rTapUv = vUv, lTapUv = vUv;",
			"float rWeight = 1.0, lWeight = 1.0;",

			"for( int i = 1; i <= KERNEL_SAMPLE_RADIUS; i ++ ) {",

				"float sampleWeight = getKernelWeight( i );",

				"rTapUv += uvIncrement;",
				"addTapInfluence( rTapUv, centerViewZ, sampleWeight, aoSum, rWeight, weightSum );",

				"lTapUv -= uvIncrement;",
				"addTapInfluence( lTapUv, centerViewZ, sampleWeight, aoSum, lWeight, weightSum );",

			"}",

			"gl_FragColor = vec4( vec3( aoSum / weightSum ), 1.0 );",

		"}"

	].join( "\n" )

};
