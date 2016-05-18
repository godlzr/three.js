/**
 * Depth-of-field post-process with bokeh shader
 */


THREE.BokehPass = function ( scene, camera, params ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	var focus = ( params.focus !== undefined ) ? params.focus : 1.0;
	var aspect = ( params.aspect !== undefined ) ? params.aspect : camera.aspect;
	var aperture = ( params.aperture !== undefined ) ? params.aperture : 0.025;
	var maxblur = ( params.maxblur !== undefined ) ? params.maxblur : 1.0;

	// render targets

	var width = params.width || window.innerWidth || 1;
	var height = params.height || window.innerHeight || 1;

	this.renderTargetColor = new THREE.WebGLRenderTarget( width, height, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat
	} );

	this.renderTargetDepth = this.renderTargetColor.clone();

	// depth material

	this.materialDepth = new THREE.MeshDepthMaterial();

	// bokeh material

	if ( THREE.BokehShader === undefined ) {

		console.error( "THREE.BokehPass relies on THREE.BokehShader" );

	}

	var bokehShader = THREE.BokehShader;
	var bokehUniforms = THREE.UniformsUtils.clone( bokehShader.uniforms );

	bokehUniforms[ "tDepth" ].value = this.renderTargetDepth.texture;

	bokehUniforms[ "focus" ].value = focus;
	bokehUniforms[ "aspect" ].value = aspect;
	bokehUniforms[ "aperture" ].value = aperture;
	bokehUniforms[ "maxblur" ].value = maxblur;

	this.materialBokeh = new THREE.ShaderMaterial( {
		uniforms: bokehUniforms,
		vertexShader: bokehShader.vertexShader,
		fragmentShader: bokehShader.fragmentShader
	} );

	this.uniforms = bokehUniforms;
	this.needsSwap = false;

};

THREE.BokehPass.prototype = Object.create( THREE.Pass.prototype );

Object.assign( THREE.BokehPass.prototype, {

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		// Render depth into texture

		renderer.renderOverride( this.materialDepth, this.scene, this.camera, this.renderTargetDepth, true );

		// Render bokeh composite

		this.uniforms[ "tColor" ].value = readBuffer.texture;

		if ( this.renderToScreen ) {

			renderer.renderPass( this.materialBokeh );

		} else {

			renderer.renderPass( this.materialBokeh, writeBuffer, this.clear );

		}

	}

} );
