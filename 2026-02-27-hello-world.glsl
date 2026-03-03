#version 410 core

uniform float fGlobalTime; // in seconds
uniform vec2 v2Resolution; // viewport resolution (in pixels)
uniform float fFrameTime; // duration of the last frame, in seconds

uniform sampler1D texFFT; // towards 0.0 is bass / lower freq, towards 1.0 is higher / treble freq
uniform sampler1D texFFTSmoothed; // this one has longer falloff and less harsh transients
uniform sampler1D texFFTIntegrated; // this is continually increasing
uniform sampler2D texPreviousFrame; // screenshot of the previous frame
uniform sampler2D texChecker;
uniform sampler2D texNoise;
uniform sampler2D texTex1;
uniform sampler2D texTex2;
uniform sampler2D texTex3;
uniform sampler2D texTex4;

layout(location = 0) out vec4 out_color; // out_color must be written in order to see anything

vec4 plas( vec2 v, float time )
{ 
	float c = 0.5 + sin( v.x * 10.0 ) + cos( sin( time + v.y ) * 80.0 );
	return vec4( sin(c * 0.2 + cos(time)), clamp(0.1, 0.1, v.y), cos( c * 0.1 + time / .4 ) * .25, 1.0 );
}
vec4 background(vec2 v, float time) {
    float x = 0.4;
    //float z = mod(texture(texFFT, 2).r*4, 1);
    float y = 0.2;
    float z = 0.2;
  return vec4(x, y, z, 1.0);
}

void main(void)
{
	vec2 uv = vec2(gl_FragCoord.x / v2Resolution.x, gl_FragCoord.y / v2Resolution.y);
	uv -= 0.5;
	uv /= vec2(v2Resolution.y / v2Resolution.x);

	vec2 m;
	m.x = cos(uv.x / uv.y) / 4 ;
	m.y = 1 / length(uv);
	float d = pow(sin(m.x),1) + pow(sin(m.y), 5) + (fGlobalTime*0.3);

  //float f = sin(fGlobalTime) * 10;
  
	float f = texture( texFFT, d ).r * 12;
	// m.x += sin( fGlobalTime ) * 0.1;
	//m.y += fGlobalTime * 0.25;
  vec4 t = background(m, fGlobalTime);
	//vec4 t = plas( m * 3.14, fGlobalTime ) / d;
	t = clamp( t, 0.0, 1.0 );
  out_color = f*t + t*0.2;
}
