varying vec2 vUv;

uniform vec3 uColorA;
uniform vec3 uColorB;

void main(){
  //gl_FragColor = vec4(1,1,vUv.y,1);
  gl_FragColor = vec4(mix( uColorA, uColorB, vec3(vUv.y)),1.0);
}