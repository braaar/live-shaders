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

float circ(float x, float y, float r) {
  return pow(x, 2) + pow(y, 2) - pow(r, 2);
}
float circHard(float x, float y, float r) {
  return clamp(pow(x, 2) + pow(y, 2) - pow(r, 2), 0.0, 1.0);
}

float square(float x, float y, float l, float h, float c) {
  return x - l + y - h;
}

float plot(vec2 st) {    
    return step(0.02, abs(st.y*0.3 - st.x));
}


void main(void)
{
	vec2 uv = vec2(gl_FragCoord.x / v2Resolution.x, gl_FragCoord.y / v2Resolution.y);
	uv -= 0.5;
	uv /= vec2(v2Resolution.y / v2Resolution.x, 1);
  
	vec4 t = circHard( uv.x, uv.y, 0.01 ) * vec4(0.3, 0.5, 0.7, 1);

  
	vec2 m;
	m.x = cos(pow(uv.x, 2) * uv.y );
	m.y = cos(length(uv))*2;
	float d = fGlobalTime*0.2;
  d += circ(m.x, m.y, 0.05);
	float f = pow(texture( texFFT, d ).r, 1) * 50;
  
  float b = sin((texture(texFFT, m.y)).r);
	//b -= plot(uv);
  vec4 bassline = m.y * b * vec4(1, 0.6,0.4,1);
  t = square(m.y, m.y/2, 0.5, 0.01, 0.5)* vec4(0.322, 0.3, 0.4,0.5);
  
  t = clamp( t, 0.0, 1.0 );
  
  float timeMod = abs(sin(fGlobalTime));
  
  
  float spectrum = smoothstep(0.25*b, -0.27, uv.y - texture(texFFT, 2*abs(sin(uv.x*0.04))).r - 0.5*texture(texFFTSmoothed, abs(sin(m.x*0.05))).r);
  spectrum /= 1;

//t *= abs(sin(fGlobalTime));

	vec4 musicVec = vec4(0.7, 0.8, 0.7*sin(f), 1) * f;
  out_color = t+(spectrum)*vec4(0.1, 0.3, 0.2, 1);
  
}