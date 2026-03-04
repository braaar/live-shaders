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
	float c = 0.5 + sin( v.x * 50.0 ) + cos( sin( v.y ) * 1.0 );
	
  float x =  sin(c * 0.2 + cos(time + 0.5))*0.5;
  float y = c*0.05;
  float z = sin( c * 0.1 ) * .05;
  z = (z + cos(v.y * v.x))/2;
  return vec4(x, y, z, 1.0 );
}


void main(void)
{
	vec2 uv = vec2(gl_FragCoord.x / v2Resolution.x, gl_FragCoord.y / v2Resolution.y);
	uv -= 0.5;
	uv /= vec2(v2Resolution.y / v2Resolution.x, 1);

	vec2 m;
	m.x = atan(uv.x / uv.y ) / 3.14;
	m.y = 1 / length(uv) * 0.5 + clamp(sin(fGlobalTime)*0.5, 0.05, 1.0);
	float d = fGlobalTime + sin( m.x * m.y ) + cos( sin(m.y) * 1.0 );

	float f = texture( texFFT, d ).r * 50;
	m.x += sin(fGlobalTime) * 0.5;
	m.y += sin(fGlobalTime) * 0.15;
	vec4 t = plas( m * 3.14, fGlobalTime ) ;
	
  t = clamp( t, 0.0, 1.0 );
	out_color = f+t;
}