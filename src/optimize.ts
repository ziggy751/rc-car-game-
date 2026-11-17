import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Batch static procedural parts by material while preserving separate dynamic assemblies. */
export function batchStatic(root:T.Object3D){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();const groups=new Map<T.Material,{geos:T.BufferGeometry[];meshes:T.Mesh[]}>();
 root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!Array.isArray(o.material)){
  const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  // Every generated batch carries the same attributes. Vertex colour material uses a separate batch.
  if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  const group=groups.get(o.material)||{geos:[],meshes:[]};group.geos.push(geo);group.meshes.push(o);groups.set(o.material,group);
 }});
 for(const [material,{geos,meshes}]of groups){if(geos.length<2){geos.forEach(g=>g.dispose());continue;}const merged=mergeGeometries(geos);if(merged){meshes.forEach(m=>m.removeFromParent());const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}geos.forEach(g=>g.dispose());}
}
