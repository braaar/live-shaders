// written and ran with shadertoy.com

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    float x = iResolution.x;
    vec2 uv = fragCoord/iResolution.xy; 
    
    // center uv
    uv -= 0.5;

    // Output to screen
    vec4 background = vec4(1, 0.5, 0.5 ,1.0);

    fragColor = background;
    
    float rpx = 200.0;
    float hpx = pow(rpx, 2.0);
    
    float circleOpacity = pow(fragCoord.x-0.5 * iResolution.x, 2.0) 
    + pow(fragCoord.y-0.5 * iResolution.y, 2.0) - hpx;
    
    fragColor = background + circleOpacity + vec4(0.5,0.2,0.2,1.0);
    
    
    //if(pow(fragCoord.x-0.5*iResolution.x, 2.0) 
    //+ pow(fragCoord.y-0.5*iResolution.y, 2.0) <= hpx) {
    //    fragColor = vec4(sin(iTime),sin(iTime),sin(iTime), 1);
    //}
}