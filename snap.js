"use strict";
// Snapchit

// main context
var gl;
var canvas;
var frameID;
//var canvas;

// tuning settings
var sett = {
	lineColor: [0.4, 1.0, 0.0],
	backColor: [0.03, 0.03, 0.03],
	tint: 0.03,
	lineCount: 300,
	preBuf: 20480,
};

function prepareCanvas()
{
	canvas = document.createElement("canvas");
	canvas.style.width = "100%";
	canvas.style.height = "100%";
	var scripts = document.getElementsByTagName("script");
	var script = scripts[scripts.length-1];
	script.parentNode.insertBefore(canvas,script);
	var dim = canvas.getBoundingClientRect();
	canvas.width = dim.width;
	canvas.height = dim.height;
	return canvas;
}

function init(canvas)
{
	canvas.addEventListener('webglcontextlost', contextLost, false);
	canvas.addEventListener('webglcontextrestored', contextRegen, false);
	gl = canvas.getContext("webgl", {antialias: false,preserveDrawingBuffer:false});
	var vao = gl.getExtension("OES_vertex_array_object");
	gl.clearColor(0.04,0.04,0.04,1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// create base shader program
	var vertShad = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertShad, vertexShaderStd);
	gl.compileShader(vertShad);
	var fragShad = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragShad, fragmentShaderStd);
	gl.compileShader(fragShad);
	var shadProg = gl.createProgram();
	gl.attachShader(shadProg, vertShad);
	gl.attachShader(shadProg, fragShad);
	gl.bindAttribLocation(shadProg, 0, 'position');
	gl.linkProgram(shadProg);

	// get locations for attrib and uniform from shader program
	var vertPos = gl.getAttribLocation(shadProg, 'position');
	var mvmU = gl.getUniformLocation(shadProg, 'modelViewMatrix');
	var pmU = gl.getUniformLocation(shadProg, 'projectionMatrix');
	var colorU = gl.getUniformLocation(shadProg, 'color');

	// create blur shader programs
	var blurVertShad = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(blurVertShad, vertexShaderBlur);
	gl.compileShader(blurVertShad);
	var blurFragShadX = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(blurFragShadX, fragmentShaderBlurX);
	gl.compileShader(blurFragShadX);
	var blurFragShadY = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(blurFragShadY, fragmentShaderBlurY);
	gl.compileShader(blurFragShadY);
	var blurFragShadNone = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(blurFragShadNone, fragmentShaderBlurNone);
	gl.compileShader(blurFragShadNone);
	var shadProgPro1 = gl.createProgram();
	gl.attachShader(shadProgPro1, blurVertShad);
	gl.attachShader(shadProgPro1, blurFragShadX);
	gl.bindAttribLocation(shadProgPro1, 0, 'position');
	gl.linkProgram(shadProgPro1);
	var shadProgPro2 = gl.createProgram();
	gl.attachShader(shadProgPro2, blurVertShad);
	gl.attachShader(shadProgPro2, blurFragShadY);
	gl.bindAttribLocation(shadProgPro2, 0, 'position');
	gl.linkProgram(shadProgPro2);
	var shadProgPro3 = gl.createProgram();
	gl.attachShader(shadProgPro3, blurVertShad);
	gl.attachShader(shadProgPro3, blurFragShadNone);
	gl.bindAttribLocation(shadProgPro3, 0, 'position');
	gl.linkProgram(shadProgPro3);

	gl.useProgram(shadProgPro1);
	gl.uniform2f(gl.getUniformLocation(shadProgPro1, 'screenSize'), canvas.width, canvas.height);
	gl.uniform1i(gl.getUniformLocation(shadProgPro1, 'texture'), 0);
	gl.useProgram(shadProgPro2);
	gl.uniform2f(gl.getUniformLocation(shadProgPro2, 'screenSize'), canvas.width, canvas.height);
	gl.uniform1i(gl.getUniformLocation(shadProgPro2, 'texture'), 0);
	gl.useProgram(shadProgPro3);
	gl.uniform2f(gl.getUniformLocation(shadProgPro3, 'screenSize'), canvas.width, canvas.height);
	gl.uniform1i(gl.getUniformLocation(shadProgPro3, 'texture'), 0);
	gl.useProgram(null);

	// create framebuffers with textures
	var fb1 = createFB();
	var fb2 = createFB();

	// setup fullscreen quad for post blur
	var screenQuad = new Float32Array([ -1.0,-1.0, 1.0,-1.0, -1.0, 1.0, 1.0, 1.0 ]);
	var vaoBlur = vao.createVertexArrayOES();
	var blurABuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, blurABuf);
	gl.bufferData(gl.ARRAY_BUFFER, screenQuad, gl.STATIC_DRAW);
	vao.bindVertexArrayOES(vaoBlur);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.enableVertexAttribArray(0);
	vao.bindVertexArrayOES(null);

	// calc ortho projection matrix
	var pm = ortho(canvas.width, canvas.height);
	var identity = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
	//var mvm2 = new Float32Array([.001,0,0,.0003,0,.001,0,0,0,0,.001,0,0,0,0,1]);
	//var mvm2 = new Float32Array([.01,0,0,.003,0,.01,0,0,0,0,.01,0,0,0,0,1]);

	// create buffer for position verticies
	var posBuf = gl.createBuffer();
	//gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	//gl.bufferData(gl.ARRAY_BUFFER, vertex, gl.STREAM_DRAW);
	//gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// create vertex array object to store attrib bindings
	var vao1 = vao.createVertexArrayOES();

	// attach array buffer to position attrib, and remember in vao
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	vao.bindVertexArrayOES(vao1);
	gl.vertexAttribPointer(vertPos, 3, gl.FLOAT, false, 0, 0);
	vao.bindVertexArrayOES(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// enable position attrib and remember in vao
	vao.bindVertexArrayOES(vao1);
	gl.enableVertexAttribArray(vertPos);
	vao.bindVertexArrayOES(null);

	// set uniforms for program
	gl.useProgram(shadProg);
	gl.uniformMatrix4fv(pmU, false, pm);
	gl.uniformMatrix4fv(mvmU, false, identity);
	gl.uniform3f(colorU, 1.0,0.0,0.0);
	gl.useProgram(null);

	// set resize handler and start rendering
	window.addEventListener('resize', resize, false);
	frameID = requestAnimationFrame(run);

	var lastUpdate = Date.now();
	var lastTimestep = 0;
	var dt = 0;

	var add = 0;
	var t1 = 0;

	function run(timestep)
	{
		// update dt
		add += (timestep - lastTimestep);
		dt = (timestep - lastTimestep) / 1000;
		lastTimestep = timestep;

		// perf start
		t1 = performance.now();


		updateMain(dt);

		if (add > 1000) {
			console.log("%c[P] Update Perf: %.4f ms", "color: #fc0;", performance.now() - t1);
		}
		t1 = performance.now();

		// upload vertex data stream and realloc array and buffer if needed
		prepareArray();
		gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
		//gl.bufferData(gl.ARRAY_BUFFER, arr.length*4, gl.STREAM_DRAW);
		if (arr.length > bufferAllocated) {
			bufferAllocated = Math.ceil(arr.length/sett.preBuf)*sett.preBuf;
			gl.bufferData(gl.ARRAY_BUFFER, bufferAllocated*4, gl.STREAM_DRAW);
			console.log("[A] bufferData alloc: " + bufferAllocated);
		}
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		var bgc = sett.backColor;
		var lc = sett.lineColor;
		var tint = sett.tint;
		var bgc2 = [bgc[0]+lc[0]*tint, bgc[1]+lc[1]*tint, bgc[2]+lc[2]*tint];

		// clear background to sett color
		gl.clearColor(bgc2[0],bgc2[1],bgc2[2],1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// clear framebuffer textures to transparent black
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb1.buffer);
		gl.clearColor(0.0,0.0,0.0,0.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb2.buffer);
		gl.clearColor(0.0,0.0,0.0,0.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// blending functions are totally wrong but look good this way
		gl.enable(gl.BLEND);

		// draw lines to fb1
		gl.useProgram(shadProg);
		gl.uniform3f(colorU, lc[0], lc[1], lc[2]);
		vao.bindVertexArrayOES(vao1);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb1.buffer);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.drawArrays(gl.TRIANGLES,0,arrayTotal/3);
		vao.bindVertexArrayOES(null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		// blur post processing
		vao.bindVertexArrayOES(vaoBlur);

		// blur pass x from fb1 to fb2
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, fb1.texture);
		gl.useProgram(shadProgPro1);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb2.buffer);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// blur pass y from fb2 to viewport
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, fb2.texture);
		gl.useProgram(shadProgPro2);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// lines from fb1 to viewport
		gl.useProgram(shadProgPro3);
		gl.bindTexture(gl.TEXTURE_2D, fb1.texture);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		gl.disable(gl.BLEND);
		gl.useProgram(null);
		vao.bindVertexArrayOES(null);

		if (add > 1000) {
			console.log("%c[P] Draw Perf: %.4f ms", "color:#ff0;", performance.now() - t1);
			add = 0;
		}

		frameID = requestAnimationFrame(run);
	}

	// throttle resize events
	var resizeID = null;
	function resize()
	{
		if (resizeID!=null) {
			window.clearTimeout(resizeID);
			resizeID = null;
		}
		resizeID = window.setTimeout(resizeactivate, 250);
	}

	function resizeactivate()
	{
		console.log("Resize");
		resizeID = null;
		// refresh internal canvas res
		var dim = gl.canvas.getBoundingClientRect();
		gl.canvas.width = dim.width;
		gl.canvas.height = dim.height;
		// refresh camera projection matrix
		pm = ortho(gl.canvas.width, gl.canvas.height);
		// refresh viewport size transformation 
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		// refresh res dependent uniforms across all shader programs
		gl.useProgram(shadProg);
		gl.uniformMatrix4fv(pmU, false, pm);
		gl.useProgram(shadProgPro1);
		gl.uniform2f(gl.getUniformLocation(shadProgPro1, 'screenSize'), gl.canvas.width, gl.canvas.height);
		gl.useProgram(shadProgPro2);
		gl.uniform2f(gl.getUniformLocation(shadProgPro2, 'screenSize'), gl.canvas.width, gl.canvas.height);
		gl.useProgram(shadProgPro3);
		gl.uniform2f(gl.getUniformLocation(shadProgPro3, 'screenSize'), gl.canvas.width, gl.canvas.height);
		gl.useProgram(null);
		// refresh texture sizes
		gl.bindTexture(gl.TEXTURE_2D, fb1.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindTexture(gl.TEXTURE_2D, fb2.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

}

// Webgl context lost event handler
function contextLost(event)
{
	event.preventDefault();
	cancelAnimationFrame(frameID);
	console.log("WebGL Context Lost");
}

// Webgl context restored event handler
function contextRegen()
{
	console.log("WebGL Context Restored");
	arrayTotal = 0;
	bufferAllocated = 0;
	arrayAllocated = 0;
	init(canvas);
}

// test lost and restore for webgl
function testLoss()
{
	var ext = gl.getExtension('WEBGL_lose_context');
	ext.loseContext();
	window.setTimeout(function(ext) {
		ext.restoreContext();
	},1000,ext);
}

// generate 2d orthographic projection matrix
function ortho(w,h)
{
	var lr = 1/ (-w);
	var bt = 1/ (-h);
	var nf = 1/ (0-10);
	var mat = new Float32Array([
		-2*lr, 0, 0, 0,
		0, -2*bt, 0, 0,
		0, 0, 2*nf, 0,
		w*lr, h*bt, 10*nf, 1
	]);
	return mat;
}

// The Float32Array must be uploaded to the gpu in whole, so the
// sizes should match, but not all of the buffer has to be drawn.
// So only reallocate array and buffer when size grows too much.
var arrayTotal = 0; //actual number of vertexes
var bufferAllocated = 0; //gpu bufferData size in vertexes
var arrayAllocated = 0; //float32array size in vertexes
var arr = new Float32Array(arrayAllocated);
function prepareArray()
{
	var i,j;
	var total = 0;
	for (i=0;i<thing.length;i++)
		total += thing[i].vert.length;
	if (total > arrayAllocated)
	{
		arrayAllocated = Math.ceil(total/sett.preBuf)*sett.preBuf;
		arr = new Float32Array(arrayAllocated);
		console.log("[A] prepareArray alloc: " + arrayAllocated);
	}
	var offset = 0;
	for (i=0;i<thing.length;i++)
	{
		for (j=0;j<thing[i].vert.length;j++)
		{
			arr[offset++] = thing[i].vert[j];
		}
		// array set was super slow in chrome...
		//arr.set(thing[i].vert,offset);
		//offset += thing[i].vert.length;
	}
	arrayTotal = offset;
}

function createFB()
{
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.bindTexture(gl.TEXTURE_2D, null);

	var buffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return {buffer: buffer, texture: tex};
}


var thing = [];
function updateMain(dt)
{
	if (thing.length == 0) thing.push(new Tris());
	var max = sett.lineCount;
	var i;
	for (i=0;i<thing.length;i++) {
		thing[i].update(dt);
		if (thing[i].done) thing.splice(i,1);
	}
	if (randI(1,3) == 2 && thing.length < max) thing.push(new Tris());
}

///////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////
function randI(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(a,b,c)
{
	return Math.max(b,Math.min(c,a));
}

///////////////////////////////////////////////////////////
// Tris object
///////////////////////////////////////////////////////////
function Tris(x,y)
{
	var cw = gl.canvas.width, ch = gl.canvas.height;
	this.pts = [];
	this.bias = randI(1,4);
	this.done = false;
	this.last = 0;
	this.bx = x || randI(1,cw/10)*10;
	this.by = y || randI(1,ch/10)*10;
	this.px = this.bx;
	this.py = this.by;
	this.life = randI(1,50)+50;
	this.w = 1;
	this.pw = 2.5;
	this.vert = [];
	this.update = Tris_update;
	this.genMesh = Tris_genMesh;
}

var jitter = 20;
var time = 0;
function Tris_update(dt)
{
	time = time + dt * 2000;
	if (time < jitter) return;
	time = 0;
	jitter = randI(10,25);

	if (this.life == 0 && this.pts.length == 0) {
		this.done = true;
		return;
	}
	if (randI(1,4) != 1) return;
	if (randI(1,3) == 1) {
		if (this.pts.length != 0) {
			this.bx = this.bx + this.pts[0].x;
			this.by = this.by + this.pts[0].y;
			this.pts.splice(0,1);
			this.genMesh();
		}
	}
	if (randI(1,2) != 1) return;
	if (this.life == 0) return;
	var du = this.bias + randI(1,3) - 1; //destination direction
	var dx = 0;
	var dy = 0;
	var amt = randI(1,3) * 10; //amount to move
	if (du > 4) du = du - 4;
	if (du < 1) du = du + 4;
	if ((du == (this.last + 2) % 4) && false)
		du = (du + 2) % 4;
	if (du == 1) dy = -amt; //up
	if (du == 2) dx = amt;  //right
	if (du == 3) dy = amt;  //down
	if (du == 4) dx = -amt; //left
	//if (this.bias == 1) dy = dy * 2;
	//if (this.bias == 2) dx = dx * 2;
	//if (this.bias == 3) dy = dy * 4;
	//if (this.bias == 4) dx = dx * 4;
	this.pts.push({x: dx, y: dy});
	this.genMesh();
	this.px = this.px + dx;
	this.py = this.py + dy;
	this.last = du;
	this.life = this.life - 1;
	if (this.px < 0 || this.px > gl.canvas.width) this.life = 0;
	if (this.py < 0 || this.py > gl.canvas.height) this.life = 0;
}

var linecount = 0;
function Tris_genMesh()
{
	if (this.done || this.pts.length < 2) this.vert = [];
	var px = this.bx;
	var py = this.by;
	var nx = 0;
	var ny = 0;
	var c = 0;
	var pc = 0;
	var w = this.w;
	this.vert = [];
	var i,j;
	var v = this.vert;
	var o = 0;
	for (i=0;i<this.pts.length;i++) {
		j = this.pts[i];
		nx = px + j.x;
		ny = py + j.y;
		if (i > 0) {
			/*
			this.vert.push(
				px-w, py-w, pc,
				px+w, py+w, pc,
				nx-w, ny-w, c,
				px+w, py+w, pc,
				nx+w, ny+w, c,
				nx-w, ny-w, c);
			*/
			v[o++]=px-w; v[o++]=py-w; v[o++]=pc;
			v[o++]=px+w; v[o++]=py+w; v[o++]=pc;
			v[o++]=nx-w; v[o++]=ny-w; v[o++]=c;
			v[o++]=px+w; v[o++]=py+w; v[o++]=pc;
			v[o++]=nx+w; v[o++]=ny+w; v[o++]=c;
			v[o++]=nx-w; v[o++]=ny-w; v[o++]=c;
		}
		linecount = linecount + 1;
		pc = c;
		c = c + (255 / this.pts.length);
		px = nx;
		py = ny;
	}
	var pw = this.pw;
	/*
	this.vert.push(
		nx, ny+pw, pc,
		nx-pw, ny, pc,
		nx, ny-pw, pc,
		nx, ny+pw, pc,
		nx+pw, ny, pc,
		nx, ny-pw, pc);
	*/
	v[o++]=nx; v[o++]=ny+pw; v[o++]=pc;
	v[o++]=nx-pw; v[o++]=ny; v[o++]=pc;
	v[o++]=nx; v[o++]=ny-pw; v[o++]=pc;
	v[o++]=nx; v[o++]=ny+pw; v[o++]=pc;
	v[o++]=nx+pw; v[o++]=ny; v[o++]=pc;
	v[o++]=nx; v[o++]=ny-pw; v[o++]=pc;

	//laser cast
	//this.vert.push(500, 500, 128);
	//this.vert.push(nx+pw, ny, 64);
	//this.vert.push(nx, ny-pw, 64);
}

///////////////////////////////////////////////////////////
// Shaders
///////////////////////////////////////////////////////////

// basic shaders

// position: x->x, y->y, z->opacity
var vertexShaderStd = 
`precision highp float;
attribute vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying float opacity;
void main() {
	opacity = position.z/255.0;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy,0.0, 1.0);
}`;

var fragmentShaderStd = 
`precision highp float;
varying float opacity;
uniform vec3 color;
void main() {
	gl_FragColor = vec4(color, opacity);
}`;

// post processing shaders

var vertexShaderBlur =
`precision highp float;
attribute vec2 position;
varying vec2 vTexCoord;
void main() {
	vTexCoord = (position + 1.0) / 2.0;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

var fragmentShaderBlurX =
`precision highp float;
varying vec2 vTexCoord;
uniform vec2 screenSize;
uniform sampler2D texture;
void main() {
	vec4 sum = vec4(0.0);
	float blurSize = 1.0/(screenSize.x/3.0);
	// blur in x (horizontal)
	// take nine samples, with the distance blurSize between them
	sum += texture2D(texture, vec2(vTexCoord.x - 4.0*blurSize, vTexCoord.y)) * 0.05;
	sum += texture2D(texture, vec2(vTexCoord.x - 3.0*blurSize, vTexCoord.y)) * 0.09;
	sum += texture2D(texture, vec2(vTexCoord.x - 2.0*blurSize, vTexCoord.y)) * 0.12;
	sum += texture2D(texture, vec2(vTexCoord.x - blurSize, vTexCoord.y)) * 0.15;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y)) * 0.16;
	sum += texture2D(texture, vec2(vTexCoord.x + blurSize, vTexCoord.y)) * 0.15;
	sum += texture2D(texture, vec2(vTexCoord.x + 2.0*blurSize, vTexCoord.y)) * 0.12;
	sum += texture2D(texture, vec2(vTexCoord.x + 3.0*blurSize, vTexCoord.y)) * 0.09;
	sum += texture2D(texture, vec2(vTexCoord.x + 4.0*blurSize, vTexCoord.y)) * 0.05;

	gl_FragColor = sum*2.1;
}`;

var fragmentShaderBlurY = 
`precision highp float;
varying vec2 vTexCoord;
uniform vec2 screenSize;
uniform sampler2D texture;
void main() {
	vec4 sum = vec4(0.0);
	float blurSize = 1.0/(screenSize.y/3.0);
	// blur in y (vertical)
	// take nine samples, with the distance blurSize between them
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y - 4.0*blurSize)) * 0.05;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y - 3.0*blurSize)) * 0.09;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y - 2.0*blurSize)) * 0.12;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y - blurSize)) * 0.15;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y)) * 0.16;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y + blurSize)) * 0.15;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y + 2.0*blurSize)) * 0.12;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y + 3.0*blurSize)) * 0.09;
	sum += texture2D(texture, vec2(vTexCoord.x, vTexCoord.y + 4.0*blurSize)) * 0.05;

	gl_FragColor = sum*2.1;
}`; 

var fragmentShaderBlurNone = 
`precision highp float;
varying vec2 vTexCoord;
uniform vec2 screenSize;
uniform sampler2D texture;
void main() {
	gl_FragColor = texture2D(texture, vec2(vTexCoord.x, vTexCoord.y));
	//vec4 Color = texture2D(texture, vTexCoord.xy);
    //float dist = distance(vTexCoord.xy, vec2(0.5,0.5));
	//float cRadius = 0.95;
	//float cSoftness = 0.85;
    //float vignette = smoothstep(cRadius, cRadius-cSoftness, dist);
    //gl_FragColor = vec4(mix(Color.rgb, Color.rgb * vignette, 0.7),max(Color.a,(1.0-vignette)*.8));
}`; 

///////////////////////////////////////////////////////////
// User control
///////////////////////////////////////////////////////////

function setLineColor(r,g,b)
{
	r = clamp(r, 0.0, 1.0);
	g = clamp(g, 0.0, 1.0);
	b = clamp(b, 0.0, 1.0);
	sett.lineColor = [r,g,b];
}






// start the program
function start()
{
	var c = prepareCanvas()
	init(c);
}
start();
