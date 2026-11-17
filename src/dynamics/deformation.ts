import * as T from 'three';
/** Load-dependent contact flattening of rubber/tread only; hubs keep their rigid geometry. */
export function tyreMaterial(source: T.MeshStandardMaterial) {
  const material = source.clone(),
    depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  const uniforms = {
    tyrePoint: { value: new T.Vector3() },
    tyreNormal: { value: new T.Vector3(0, 1, 0) },
    tyreAxis: { value: new T.Vector3(1, 0, 0) },
    tyreCentre: { value: new T.Vector3() },
    tyreDeflection: { value: 0 },
  };
  const compile = (shader: { uniforms: Record<string, unknown>; vertexShader: string }) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'uniform vec3 tyrePoint; uniform vec3 tyreNormal; uniform vec3 tyreAxis; uniform vec3 tyreCentre; uniform float tyreDeflection;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
   vec4 mvPosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    mvPosition=instanceMatrix*mvPosition;
   #endif
   vec3 worldTyre=(modelMatrix*mvPosition).xyz;
   float height=dot(worldTyre-tyrePoint,tyreNormal);
   float enabled=step(0.00005,tyreDeflection);
   worldTyre+=tyreNormal*min(tyreDeflection,max(0.0,-height))*enabled;
   float side=dot(worldTyre-tyreCentre,tyreAxis);
   worldTyre+=tyreAxis*sign(side)*tyreDeflection*0.5*(1.0-smoothstep(0.0,0.025,height))*enabled;
   mvPosition=viewMatrix*vec4(worldTyre,1.0);
   gl_Position=projectionMatrix*mvPosition;
  `,
    );
  };
  material.onBeforeCompile = compile;
  depth.onBeforeCompile = compile;
  material.customProgramCacheKey = () => 'rc-load-tyre-v1';
  depth.customProgramCacheKey = () => 'rc-load-depth-v1';
  return { material, depth, uniforms };
}
