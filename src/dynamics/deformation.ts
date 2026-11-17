import * as T from 'three';
/** Up to six actual contact patches; width bands and arc falloff keep remote rubber unchanged. */
export function tyreMaterial(source: T.MeshStandardMaterial) {
  const material = source.clone(),
    depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  const uniforms = {
    tyrePoint: { value: new T.Vector3() },
    tyreNormal: { value: new T.Vector3(0, 1, 0) },
    tyreAxis: { value: new T.Vector3(1, 0, 0) },
    tyreCentre: { value: new T.Vector3() },
    tyreDeflection: { value: 0 },
    tyreWidth: { value: 0.044 },
    tyreRadius: { value: 0.059 },
    tyreSideFlex: { value: 0 },
    patchCount: { value: 0 },
    patchPoints: { value: Array.from({ length: 6 }, () => new T.Vector3()) },
    patchNormals: { value: Array.from({ length: 6 }, () => new T.Vector3(0, 1, 0)) },
    patchDepths: { value: new Float32Array(6) },
  };
  const compile = (shader: { uniforms: Record<string, unknown>; vertexShader: string }) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'uniform vec3 tyrePoint;uniform vec3 tyreNormal;uniform vec3 tyreAxis;uniform vec3 tyreCentre;uniform float tyreDeflection;uniform float tyreWidth;uniform float tyreRadius;uniform float tyreSideFlex;uniform int patchCount;uniform vec3 patchPoints[6];uniform vec3 patchNormals[6];uniform float patchDepths[6];\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
   vec4 mvPosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    mvPosition=instanceMatrix*mvPosition;
   #endif
   vec3 worldTyre=(modelMatrix*mvPosition).xyz;vec3 displacement=vec3(0.0);float bulge=0.0;
   for(int i=0;i<6;i++){if(i>=patchCount)break;vec3 delta=worldTyre-patchPoints[i];float h=dot(delta,patchNormals[i]);float across=dot(delta,tyreAxis);vec3 tangent=delta-patchNormals[i]*h-tyreAxis*across;float band=1.0-smoothstep(tyreWidth*.16,tyreWidth*.42,abs(across));float arc=1.0-smoothstep(tyreRadius*.20,tyreRadius*.85,length(tangent));float influence=band*arc;vec3 d=patchNormals[i]*min(patchDepths[i],max(0.0,-h))*influence;if(length(d)>length(displacement))displacement=d;bulge=max(bulge,patchDepths[i]*influence*(1.0-smoothstep(0.0,.025,h)));}
   float deformEnabled=step(.00005,tyreDeflection);worldTyre+=displacement*deformEnabled;float side=dot(worldTyre-tyreCentre,tyreAxis);worldTyre+=tyreAxis*(sign(side)*bulge*.42+tyreSideFlex*min(1.0,bulge/.003))*deformEnabled;
   mvPosition=viewMatrix*vec4(worldTyre,1.0);gl_Position=projectionMatrix*mvPosition;
  `,
    );
  };
  material.onBeforeCompile = compile;
  depth.onBeforeCompile = compile;
  material.customProgramCacheKey = () => 'rc-local-patches-v2';
  depth.customProgramCacheKey = () => 'rc-local-depth-v2';
  return { material, depth, uniforms };
}
