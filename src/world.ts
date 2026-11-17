import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Sky } from 'three/addons/objects/Sky.js';
import {box,mesh,metal,rod,tube,label,noiseTexture} from './materials';
export const trailX=(z:number)=>Math.sin(z*.42)*.65;
export function groundHeight(x:number,z:number){
 const trailDistance=Math.abs(x-trailX(z));const ridge=.15*Math.sin(z*.6)+.1*Math.sin(x*.8+z*.3);
 const detail=(Math.sin(x*14+z*7)*Math.sin(z*13-x*4)*.014+Math.sin(x*4-z*3)*.025)*Math.min(1,trailDistance+.12);
 const hill=.7*Math.exp(-((x+3)**2+(z-6)**2)/18)+.35*Math.exp(-((x-3)**2+(z-9)**2)/10);
 const creek=-.19*Math.exp(-(((z-3.7)/.46)**2));
 const blend=T.MathUtils.smoothstep(Math.hypot(x,z),.35,.75);
 return (ridge+detail+hill+creek)*blend;
}
export const trails=[{name:'Fern Creek',type:'FOREST TRAIL',grade:'Moderate',distance:'24 m',x:0,z:0,description:'Follow the creek upstream. Find your line through roots, granite and shallow water.'},{name:'Granite Spine',type:'TECHNICAL ASCENT',grade:'Advanced',distance:'18 m',x:-2,z:5,description:'Off-camber granite, tall ledges and exposed lines. Slow inputs and soft tyres recommended.'},{name:'The Timberline',type:'PRECISION COURSE',grade:'Moderate',distance:'16 m',x:.65,z:2.8,description:'Cross the timber bridge, then thread the gates. Momentum is less useful than precision.'}];
export class Park {
 group=new T.Group();garage=new T.Group();water:T.Mesh; sun:T.DirectionalLight;vegetation=new T.Group();colliders:RAPIER.Collider[]=[];
 constructor(public scene:T.Scene,public physics:RAPIER.World){
  const groundTex=noiseTexture('ground',512);groundTex.repeat.set(70,70);
  const rockTex=noiseTexture('rock',512);rockTex.repeat.set(2,2);
  const rockMat=new T.MeshStandardMaterial({color:'#8e8a77',map:rockTex,bumpMap:rockTex,bumpScale:.007,roughness:.98});
  const moss=new T.MeshStandardMaterial({color:'#414e2a',roughness:1,map:rockTex,bumpMap:rockTex,bumpScale:.008});
  const groundMat=new T.MeshStandardMaterial({map:groundTex,vertexColors:true,bumpMap:groundTex,bumpScale:.005,roughness:1});
  const geo=new T.PlaneGeometry(40,40,240,240);geo.rotateX(-Math.PI/2);const positions=geo.attributes.position;const colors=[];
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getZ(i),y=groundHeight(x,z);positions.setY(i,y);
   const d=Math.abs(x-trailX(z));const color=new T.Color(d<.52?'#ae9672':d<.85?'#6b7048':'#53613b');if(Math.abs(z-3.7)<.35)color.set('#635547');
   color.multiplyScalar(.85+.15*Math.sin(x*17+z*8));colors.push(color.r,color.g,color.b);
  }geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();mesh(geo,groundMat,this.group);this.collider(geo);
  // Authored granite steps: purposeful lines, with lower shoulders for alternate routes.
  const rocks=[[-.24,.9,.19,.12,.24],[.22,1.23,.21,.14,.22],[-.19,1.58,.22,.16,.22],[.39,1.98,.25,.18,.22],[-.05,2.15,.19,.13,.3],[-2.2,5,.4,.27,.6],[-2,5.6,.5,.35,.6],[-2.4,6.2,.5,.4,.65],[-1.9,6.9,.5,.43,.65],[-1.5,7.7,.5,.32,.7]];
  let seed=87;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const makeRock=(x:number,z:number,sx:number,sy:number,sz:number,collide=true)=>{
   const g=new T.IcosahedronGeometry(1,3);const p=g.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.11*Math.sin(x*12+y*9)*Math.sin(z*8-x*4)+.035*Math.sin(x*34+z*23);p.setXYZ(i,x*n*sx,y*n*sy,z*n*sz);}
   g.computeVertexNormals();const r=mesh(g,rand()>.23?rockMat:moss,this.group,[x,groundHeight(x,z)+sy*.25,z]);r.rotation.y=rand()*6;
   if(collide){r.updateMatrix();const c=g.clone().applyMatrix4(r.matrix);this.collider(c);c.dispose();}
  };
  for(const [x,z,sx,sy,sz]of rocks)makeRock(x,z,sx,sy,sz);
  for(let i=0;i<125;i++){const x=(rand()-.5)*26,z=(rand()-.2)*27;if(Math.abs(x-trailX(z))<.75&&z<10)continue;makeRock(x,z,.08+rand()*.6,.06+rand()*.4,.1+rand()*.6,Math.abs(x)<6&&z<14);}
  // Shallow transparent creek, animated ripples; the bed is the same collision terrain.
  const waterMat=new T.MeshPhysicalMaterial({color:'#527b76',roughness:.18,metalness:.2,transparent:true,opacity:.64,clearcoat:1,normalMap:noiseTexture('rock'),normalScale:new T.Vector2(.09,.09),side:T.DoubleSide});
  this.water=mesh(new T.PlaneGeometry(25,.78,80,8),waterMat,this.group,[0,groundHeight(0,3.7)+.13,3.7]);this.water.rotation.x=-Math.PI/2;this.water.receiveShadow=true;
  // Bridge follows an intentionally shallow grade across the stream.
  const wood=metal('#847253',.91,0);wood.map=noiseTexture('wood');const iron=metal('#292f29',.7,.65);
  for(let i=0;i<23;i++){
   const z=3.08+i*.055;const y=.11+Math.sin(i/22*Math.PI)*.07;const plank=box(this.group,wood,[.51,.022,.05],[.65,y,z]);
   const g=plank.geometry.clone();plank.updateMatrix();g.applyMatrix4(plank.matrix);this.collider(g);g.dispose();
   for(const x of [.42,.88])mesh(new T.SphereGeometry(.003,5,4),iron,this.group,[x,y+.012,z]);
  }
  for(const x of [.39,.91]){tube(this.group,wood,[[x,.12,3.04],[x,.18,3.7],[x,.12,4.35]],.019);for(const z of [3.1,3.7,4.3])rod(this.group,wood,[x,.06,z],[x,.37,z],.014);tube(this.group,iron,[[x,.36,3.1],[x,.33,3.4],[x,.36,3.7],[x,.33,4],[x,.36,4.3]],.004);}
  // Forest canopy: branching trunks and needle-bearing boughs instanced into one draw call.
  const barkTex=noiseTexture('bark');barkTex.repeat.set(3,7);const bark=new T.MeshStandardMaterial({color:'#6d614b',map:barkTex,bumpMap:barkTex,bumpScale:.015,roughness:1});
  const leafMaterial=new T.MeshStandardMaterial({color:'#acbe9c',roughness:1,side:T.DoubleSide});
  // Needle sprays with branching silhouettes: open geometry, no stacked cone canopies.
  const leafGeo=new T.BufferGeometry();const needles:number[]=[];const leafColors:number[]=[];
  for(let branch=-1;branch<=1;branch++)for(let n=0;n<13;n++)for(const side of [-1,1]){
   const t=n/13,z=t*.94,x=branch*(.12+Math.sin(t*Math.PI)*.20),y=-t*.12;
   const reach=(1-t*.6)*(.12+Math.abs(branch)*.035),ex=x+side*reach,ez=z+.07;
   needles.push(x,y,z,ex,y+.018,ez,x+side*.024,y+.004,z+.06);
   const c=new T.Color().setHSL(.24+(n%3)*.012,.25,.16+(n%4)*.025);for(let k=0;k<3;k++)leafColors.push(c.r,c.g,c.b);
  }
  leafGeo.setAttribute('position',new T.Float32BufferAttribute(needles,3));leafGeo.setAttribute('color',new T.Float32BufferAttribute(leafColors,3));leafGeo.computeVertexNormals();leafMaterial.vertexColors=true;
  const foliage=new T.InstancedMesh(leafGeo,leafMaterial,6200);let idx=0;const dummy=new T.Object3D();
  for(let i=0;i<110;i++){
   const x=(rand()-.5)*33,z=(rand()-.5)*38;if(Math.abs(x-trailX(z))<1.15&&z<12)continue;
   const y=groundHeight(x,z),h=2.3+rand()*3.5,r=.055+rand()*.055;
   const trunk=mesh(new T.CylinderGeometry(r*.2,r,h,12,5),bark,this.vegetation,[x,y+h/2,z]);
   if(Math.abs(x)<5&&z<12)this.colliders.push(physics.createCollider(RAPIER.ColliderDesc.cylinder(h/2,r).setTranslation(x,y+h/2,z)));
   for(let l=0;l<11;l++){
    const cy=y+h*(.23+l*.06),spread=(1-l/13)*(.38+h*.08);
    for(let b=0;b<5;b++){
     const a=b*Math.PI*.4+l*.9+rand()*.3;const ex=x+Math.cos(a)*spread,ez=z+Math.sin(a)*spread;
     if(i<25)rod(this.vegetation,bark,[x,cy,z],[ex,cy-.12,ez],r*.18);
     if(idx<6200){dummy.position.set(x,cy,z);dummy.scale.set(spread,spread,spread*1.3);dummy.rotation.set((rand()-.5)*.3,Math.PI/2-a,(rand()-.5)*.2);dummy.updateMatrix();foliage.setMatrixAt(idx++,dummy.matrix);foliage.setColorAt(idx-1,new T.Color().setHSL(.23+rand()*.05,.2+rand()*.18,.31+rand()*.18));}
    }
   }
   for(let j=0;j<4;j++){const a=j*Math.PI/2+rand();tube(this.vegetation,bark,[[x,y+.08,z],[x+Math.cos(a)*.13,y+.015,z+Math.sin(a)*.13],[x+Math.cos(a)*.35,groundHeight(x+Math.cos(a)*.35,z+Math.sin(a)*.35),z+Math.sin(a)*.35]],.016);}
  }
  foliage.count=idx;foliage.castShadow=false;this.vegetation.add(foliage);
  // Pinnate ferns, each frond made from individual tapered leaflets.
  const fernGeo=new T.BufferGeometry();const vertices=[];
  for(let f=0;f<7;f++)for(let i=1;i<10;i++)for(const side of [-1,1]){
   const t=i/10,a=f*Math.PI*2/7,r=t*.17,y=Math.sin(t*Math.PI)*.11;const x=Math.cos(a)*r,z=Math.sin(a)*r;const len=(1-t)*.05;
   vertices.push(x,y,z,x+Math.cos(a+side*.95)*len,y+.006,z+Math.sin(a+side*.95)*len,x+Math.cos(a)*.018,y+.004,z+Math.sin(a)*.018);
  }fernGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));fernGeo.computeVertexNormals();
  const ferns=new T.InstancedMesh(fernGeo,new T.MeshStandardMaterial({color:'#738749',roughness:.95,side:T.DoubleSide}),850);
  for(let i=0;i<850;i++){let x=(rand()-.5)*22,z=(rand()-.3)*25;if(Math.abs(x-trailX(z))<.52){x+=x>0?.7:-.7;}dummy.position.set(x,groundHeight(x,z),z);dummy.scale.setScalar(.5+rand()*1.3);dummy.rotation.set(0,rand()*6,0);dummy.updateMatrix();ferns.setMatrixAt(i,dummy.matrix);}this.vegetation.add(ferns);this.group.add(this.vegetation);
  // Fallen log and root obstacle with collision.
  const log=rod(this.group,bark,[-.55,groundHeight(-.55,5)+.04,5],[.55,groundHeight(.55,5.25)+.04,5.25],.043);log.updateMatrix();this.collider(log.geometry.clone().applyMatrix4(log.matrix));
  for(let j=0;j<4;j++){
   const z=.8+j*2.05;for(const side of [-1,1]){const x=trailX(z)+side*.38;const y=groundHeight(x,z);rod(this.group,metal('#d9b75e',.6,0),[x,y,z],[x,y+.15,z],.003);const flag=mesh(new T.PlaneGeometry(.065,.05),label(String(j+1),'#20251c','#d9b75e'),this.group,[x,y+.13,z]);flag.rotation.y=side*.4;}
  }
  this.sign('FERN CREEK','01  /  MODERATE',-1.05,.2);
  this.sign('GRANITE SPINE','02  /  ADVANCED',-2.7,4.7);
  // Distant ridgeline, continuous triangulated mountains and subtle snow caps.
  const mountainMat=new T.MeshStandardMaterial({color:'#747c74',roughness:1,flatShading:true});
  for(let i=0;i<17;i++){
   const angle=i/17*Math.PI*2;const x=Math.cos(angle)*47,z=Math.sin(angle)*47,h=10+rand()*15;const g=new T.ConeGeometry(9+rand()*6,h,7,5);const p=g.attributes.position;for(let j=0;j<p.count;j++){const y=p.getY(j);p.setY(j,y+Math.sin(p.getX(j)*1.7+p.getZ(j))*Math.min(2,(h/2-y)*.1));}g.computeVertexNormals();mesh(g,mountainMat,this.group,[x,h/2-3,z]);
  }
  scene.add(this.group);
  const sky=new Sky();sky.scale.setScalar(300);sky.material.uniforms.turbidity.value=5;sky.material.uniforms.rayleigh.value=1.8;const sunPos=new T.Vector3(-25,35,-15);sky.material.uniforms.sunPosition.value.copy(sunPos);scene.add(sky);
  scene.add(new T.HemisphereLight('#d7e8ed','#4f5335',2.1));
  this.sun=new T.DirectionalLight('#ffe2af',4.2);this.sun.position.copy(sunPos);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:80});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.006;this.sun.shadow.radius=3;scene.add(this.sun,this.sun.target);
  scene.fog=new T.FogExp2('#a0afa0',.021);
  this.buildGarage();scene.add(this.garage);
 }
 collider(geo:T.BufferGeometry){const positions=new Float32Array(geo.attributes.position.array);const indices=geo.index?new Uint32Array(geo.index.array):Uint32Array.from({length:positions.length/3},(_,i)=>i);this.colliders.push(this.physics.createCollider(RAPIER.ColliderDesc.trimesh(positions,indices).setFriction(.8)));}
 sign(title:string,sub:string,x:number,z:number){const y=groundHeight(x,z),wood=metal('#554d39',.9,0);for(const a of [-.17,.17])rod(this.group,wood,[x+a,y,z],[x+a,y+.50,z],.014);box(this.group,metal('#25322a',.9,0),[.43,.24,.026],[x,y+.42,z]);mesh(new T.PlaneGeometry(.39,.098),label(title,'#efdfb5'),this.group,[x,y+.45,z-.016]).rotation.y=Math.PI;mesh(new T.PlaneGeometry(.36,.07),label(sub,'#b3b8a0'),this.group,[x,y+.38,z-.016]).rotation.y=Math.PI;}
 buildGarage(){
  const g=this.garage;g.position.x=60;const charcoal=metal('#202b2b',.6,.5),wood=metal('#807355',.8,0);wood.map=noiseTexture('wood');const steel=metal('#7f8783',.35,.8),red=metal('#8d4429'),rubber=metal('#12191b',.92,0);
  box(g,metal('#434b45',.98,0),[3,.06,3],[0,-.04,0]);box(g,charcoal,[3,1.8,.06],[0,.85,-.86]);box(g,charcoal,[.05,1.8,2.5],[-1.49,.85,.3]);
  // Workbench with milled edge, drawers, vise and a rubber service mat.
  box(g,wood,[1.3,.045,.67],[0,.3,0]);box(g,rubber,[.69,.006,.49],[0,.326,0]);
  for(const x of [-.5,.5])box(g,charcoal,[.035,.3,.035],[x,.13,.23]);
  for(const x of [-.48,.48]){box(g,charcoal,[.26,.27,.53],[x,.14,-.015]);for(let i=0;i<5;i++){box(g,steel,[.23,.003,.002],[x,.045+i*.048,.253]);box(g,steel,[.10,.008,.012],[x,.065+i*.048,.258]);}}
  // Shelves with spare wheels, shock sets, motor cans and battery boxes.
  for(let k=0;k<3;k++){
   const y=.37+k*.28;box(g,wood,[2.7,.023,.25],[0,y,-.71]);
   for(let i=0;i<7;i++){
    const x=-1.1+i*.35;
    if(k===0){const tyre=mesh(new T.TorusGeometry(.053,.02,12,32),rubber,g,[x,y+.08,-.66]);tyre.rotation.y=.2;mesh(new T.TorusGeometry(.032,.004,8,24),steel,g,[x,y+.08,-.636]);}
    if(k===1){box(g,red,[.20,.095,.12],[x,y+.06,-.69]);mesh(new T.PlaneGeometry(.16,.04),label(i%2?'DRIVETRAIN':'TRAIL / PARTS'),g,[x,y+.06,-.625]);}
    if(k===2){for(let j=0;j<3;j++){const motor=mesh(new T.CylinderGeometry(.018,.018,.06,20),i%2?red:steel,g,[x+j*.05,y+.04,-.69]);motor.rotation.x=Math.PI/2;}}
   }
  }
  // Pegboard tool panel.
  box(g,metal('#594e3b',.9,0),[.64,.54,.016],[-.99,.64,-.54]);
  for(let i=0;i<9;i++){const x=-1.25+i*.065;rod(g,steel,[x,.58,-.52],[x,.81-i%3*.045,-.52],.004);box(g,i%2?red:rubber,[.015,.064,.016],[x,.56,-.52]);}
  for(const x of [-1.15,-.45,.3,1.05]){
   box(g,charcoal,[.48,.024,.04],[x,1.26,-.55]);box(g,new T.MeshStandardMaterial({color:'#fff0cc',emissive:'#ffe2a1',emissiveIntensity:3}),[.44,.008,.035],[x,1.245,-.55]);
  }
  mesh(new T.PlaneGeometry(.65,.16),label('RIDGEBOUND / WORKS','#e7dcc0'),g,[.76,1.03,-.81]);
  // Bench spares and hand tools at actual RC scale.
  for(let i=0;i<4;i++){const x=-.46+i*.047;rod(g,steel,[x,.335,.13],[x+.02,.335,.24],.002);box(g,red,[.008,.008,.028],[x+.02,.335,.25]);}
  box(g,charcoal,[.075,.034,.07],[.48,.344,.02]);box(g,steel,[.055,.014,.08],[.48,.366,.02]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const gear=mesh(new T.TorusGeometry(.018,.004,6,24),steel,g,[.36+Math.cos(a)*.04,.337,-.12+Math.sin(a)*.04]);gear.rotation.x=Math.PI/2;}
  const key=new T.PointLight('#ffe5ba',4,4,2);key.position.set(.65,1.1,.6);g.add(key);const fill=new T.PointLight('#a9c5d6',2,3,2);fill.position.set(-.6,.9,.4);g.add(fill);
 }
 update(time:number,position:T.Vector3){const mat=this.water.material as T.MeshPhysicalMaterial;mat.normalMap!.offset.set(time*.007,time*.011);this.sun.position.copy(position).add(new T.Vector3(-10,16,-8));this.sun.target.position.copy(position);this.sun.target.updateMatrixWorld();}
}
