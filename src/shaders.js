export const toonVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const toonFragmentShader = `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(n, light), 0.0);
    float toon = step(0.5, diff) * 0.8 + 0.2;
    vec3 viewDir = normalize(-vViewPos);
    float rim = smoothstep(0.5, 1.0, max(0.0, dot(n, viewDir)));
    gl_FragColor = vec4(uColor * (toon + rim * 0.15), 1.0);
  }
`;

export const outlineVertexShader = `
  uniform float uOutlineWidth;

  void main() {
    vec3 nrm = normalize(normalMatrix * normal);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec2 offset = normalize(nrm.xy + vec2(0.001)) * uOutlineWidth * clip.w;
    clip.xy += offset;
    gl_Position = clip;
  }
`;

export const outlineFragmentShader = `
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;
