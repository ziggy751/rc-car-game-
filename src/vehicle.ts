import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box,mesh,metal,rod,tube,label,noiseTexture} from './materials';
export const wheelPositions=[[-.128,0,.162],[.128,0,.162],[-.128,0,-.162],[.128,0,-.162]];
export class Crawler {
 root=new T.Group();shell=new T.Group();mechanics=new T.Group();wheels:T.Group[]=[];axles:T.Group[]=[];springs:T.Group[]=[];links:T.Mesh[]=[]; paint=metal('#c48745',.3,.48);rim=metal('#be9d68',.35,.85); radius=.059;spin=[0,0,0,0];
 constructor(){
 const black=metal('#171c1d',.52,.65),steel=metal('#79848a',.24,.9),red=metal('#b93f22',.3,.6),rubber=new T.MeshStandardMaterial({color:'#151718',roughness:.94,map:noiseTexture('rubber')});
 this.root.add(this.shell,this.mechanics);const c=this.mechanics;
 // Continuous ladder chassis rails, shaped through their raised axle clearances.
 for(const x of [-.067,.067]){tube(c,black,[[x,.005,-.23],[x,.015,-.19],[x,.045,-.13],[x,.03,-.06],[x,.03,.07],[x,.045,.15],[x,.015,.23]],.007);for(let z=-.18;z<.2;z+=.035){const bolt=mesh(new T.CylinderGeometry(.0023,.0023,.016,6),steel,c,[x,.03,z]);bolt.rotation.z=Math.PI/2;}}
 for(const z of [-.19,-.08,.08,.19])box(c,black,[.146,.009,.012],[0,.028,z]);
 box(c,black,[.11,.008,.13],[0,.022,0]);
 const motor=mesh(new T.CylinderGeometry(.018,.018,.055,32),red,c,[.02,.054,-.02]);motor.rotation.z=Math.PI/2;
 for(let i=0;i<8;i++)box(c,steel,[.003,.012,.002],[-.012+i*.009,.069,-.02]);
 box(c,black,[.045,.036,.042],[-.015,.05,.036]);
 box(c,metal('#222d39'),[.053,.026,.092],[0,.066,-.119]);box(c,metal('#3681a0'),[.047,.001,.07],[0,.080,-.119]);
 for(const z of [-.15,-.09])box(c,black,[.06,.004,.008],[0,.084,z]);
 box(c,red,[.035,.014,.027],[-.041,.052,.085]);
 for(let i=0;i<8;i++)box(c,black,[.003,.009,.029],[-.054+i*.004,.064,.085]);
 box(c,black,[.027,.019,.021],[.04,.055,.073]);
 tube(c,red,[[0,.08,-.08],[.048,.096,-.04],[.056,.07,.08],[.01,.06,.09]],.002);
 tube(c,metal('#d6a14d'),[[.02,.05,-.02],[.06,.09,.02],[.045,.065,.075]],.0015);
 tube(c,black,[[-.02,.08,-.08],[-.05,.09,-.04],[-.05,.07,.08]],.002);
 // Sculpted original short wheelbase expedition body, separate hood, cabin and rear tub.
 const s=this.shell;
 const rounded=(dims:number[],p:number[],m:T.Material=this.paint,r=.01)=>mesh(new RoundedBoxGeometry(...dims as [number,number,number],3,r),m,s,p);
 // Watertight stamped side panels with true arched cut-outs, not a solid lower box.
 for(const side of [-1,1]){
  const shape=new T.Shape();shape.moveTo(-.225,.14);shape.lineTo(.224,.14);shape.lineTo(.244,.064);
  for(let j=0;j<=28;j++){const a=Math.PI*j/28;shape.lineTo(.162+Math.cos(a)*.081,.015+Math.sin(a)*.081);}
  shape.lineTo(.081,.076);shape.lineTo(-.081,.076);
  for(let j=0;j<=28;j++){const a=Math.PI*j/28;shape.lineTo(-.162+Math.cos(a)*.081,.015+Math.sin(a)*.081);}
  shape.lineTo(-.244,.064);shape.closePath();
  const panel=mesh(new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,steps:1}),this.paint,s);panel.rotation.y=-Math.PI/2;panel.position.x=side*.104;
 }
 rounded([.201,.023,.139],[0,.144,.134]);
 rounded([.196,.035,.027],[0,.135,-.196]);
 rounded([.203,.025,.185],[0,.264,-.047],this.paint,.008);
 const glass=new T.MeshPhysicalMaterial({color:'#203637',roughness:.12,metalness:.25,transparent:true,opacity:.72,clearcoat:1});
 // Window surfaces and thin structural pillars, rather than a solid cuboid cabin.
 const wind=box(s,glass,[.184,.087,.003],[0,.209,.05]);wind.rotation.x=-.17;
 box(s,glass,[.184,.089,.003],[0,.211,-.138]);
 for(const x of [-.103,.103]){
  for(const z of [.054,-.14])rod(s,this.paint,[x,.159,z],[x*.93,.255,z-.012],.005);
  rod(s,this.paint,[x,.162,-.055],[x,.253,-.055],.004);
  box(s,glass,[.002,.079,.075],[x,.211,-.002]);box(s,glass,[.002,.079,.065],[x,.211,-.1]);
  box(s,this.paint,[.005,.047,.179],[x,.145,-.044]);
  for(const z of [-.015,-.10]){box(s,black,[.007,.004,.018],[x*1.03,.169,z]);box(s,steel,[.007,.008,.005],[x*1.04,.126,z]);}
  box(s,black,[.013,.009,.26],[x*1.13,.083,-.03]);
  box(s,black,[.018,.025,.027],[x*1.13,.207,.038]);
  // Curved wheel arches, open below for visible suspension.
  for(const z of [-.162,.162]){
   const pts=[];for(let j=0;j<=20;j++){const a=Math.PI*j/20;pts.push(new T.Vector3(x*1.07,.015+Math.sin(a)*.081,z+Math.cos(a)*.081));}
   mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.009,8,false),black,s);
  }
  const mark=mesh(new T.PlaneGeometry(.098,.024),label('RIDGE / 01'),s,[x*1.015,.14,-.05]);mark.rotation.y=x>0?Math.PI/2:-Math.PI/2;
 }
 for(const x of [-.08,.08]){rod(s,black,[x,.157,.083],[x,.157,.176],.0012);box(s,black,[.011,.002,.027],[x,.159,.101]);}
 for(const side of [-1,1])for(const z of [-.162,.162]){
  const shape=new T.Shape();for(let j=0;j<=32;j++){const a=Math.PI*j/32;const u=Math.cos(a)*.082,v=.015+Math.sin(a)*.082;j===0?shape.moveTo(u,v):shape.lineTo(u,v);}for(let j=32;j>=0;j--){const a=Math.PI*j/32;shape.lineTo(Math.cos(a)*.089,.015+Math.sin(a)*.089);}shape.closePath();const lip=mesh(new T.ExtrudeGeometry(shape,{depth:.021,bevelEnabled:false}),black,s);lip.rotation.y=-Math.PI/2;lip.position.set(side<0?-.104:.125,0,z);
 }
 // Grille, recessed slots, headlight lens rings and front winch.
 rounded([.203,.066,.016],[0,.113,.208]);
 for(let x=-.045;x<=.045;x+=.015)rounded([.007,.041,.004],[x,.116,.218],black,.003);
 for(const x of [-.077,.077]){
  const ring=mesh(new T.CylinderGeometry(.019,.019,.006,32),black,s,[x,.123,.22]);ring.rotation.x=Math.PI/2;
  const lens=mesh(new T.CylinderGeometry(.014,.014,.007,32),new T.MeshStandardMaterial({color:'#ffe6b0',emissive:'#ffcf80',emissiveIntensity:1.7,roughness:.16}),s,[x,.123,.224]);lens.rotation.x=Math.PI/2;
  for(let j=-1;j<=1;j++)box(s,steel,[.001,.022,.001],[x+j*.006,.123,.229]);
  box(s,new T.MeshStandardMaterial({color:'#ba2d19',emissive:'#841a0b',emissiveIntensity:.4}),[.018,.024,.006],[x,.13,-.213]);
 }
 rounded([.235,.019,.03],[0,.072,.234],black,.004);rounded([.23,.018,.02],[0,.075,-.22],black,.004);
 box(s,black,[.06,.025,.023],[0,.088,.235]);const drum=mesh(new T.CylinderGeometry(.009,.009,.038,20),steel,s,[0,.094,.25]);drum.rotation.z=Math.PI/2;
 for(const x of [-.072,.072]){const hook=mesh(new T.TorusGeometry(.008,.002,8,16,Math.PI*1.7),red,s,[x,.064,.25]);hook.rotation.z=.4;}
 // Interior seats, dashboard and steering wheel.
 for(const x of [-.047,.047]){rounded([.038,.013,.041],[x,.16,-.035],black,.006);rounded([.038,.049,.01],[x,.186,-.055],black,.007);box(s,red,[.004,.043,.003],[x-.01,.186,-.048]);}
 box(s,black,[.18,.017,.027],[0,.182,.035]);const steering=mesh(new T.TorusGeometry(.013,.002,8,24),black,s,[-.05,.197,.018]);steering.rotation.x=-.6;
 // Roof rack with cross rails, hardware, lightbar and rescue equipment.
 for(const x of [-.092,.092])for(const y of [.287,.301])rod(s,black,[x,y,-.14],[x,y,.045],.0025);
 for(const z of [-.14,.045])for(const y of [.287,.301])rod(s,black,[-.092,y,z],[.092,y,z],.0025);
 for(let z=-.14;z<.05;z+=.025)rod(s,black,[-.092,.282,z],[.092,.282,z],.002);
 box(s,black,[.163,.015,.014],[0,.281,.051]);
 for(let i=0;i<12;i++)box(s,new T.MeshStandardMaterial({color:'#fff1c2',emissive:'#ffdda0',emissiveIntensity:1}),[.01,.008,.004],[-.072+i*.013,.283,.059]);
 box(s,metal('#b04927'),[.065,.014,.037],[.039,.3,-.086]);for(let i=0;i<9;i++)box(s,black,[.004,.002,.027],[.012+i*.007,.308,-.086]);
 rounded([.059,.025,.05],[-.037,.303,-.095],metal('#656848'),.004);
 const antenna=rod(s,black,[.092,.16,-.16],[.094,.32,-.16],.0008);antenna.name='antenna';
 // Four genuinely separate wheel assemblies; instanced tread and beadlock hardware.
 for(let i=0;i<4;i++){
  const w=this.createWheel(rubber,steel,black);this.wheels.push(w);this.root.add(w);w.position.set(wheelPositions[i][0],-.024,wheelPositions[i][2]);
  const spring=new T.Group();this.root.add(spring);this.springs.push(spring);
  mesh(new T.CylinderGeometry(.006,.006,.045,12),red,spring,[0,.0225,0]);mesh(new T.CylinderGeometry(.0027,.0027,.055,10),steel,spring,[0,.002,0]);
  const points=[];for(let j=0;j<=160;j++){const t=j/160;points.push(new T.Vector3(Math.cos(t*Math.PI*16)*.008,t*.063-.018,Math.sin(t*Math.PI*16)*.008));}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),160,.00135,5,false),steel,spring);
 }
 for(let i=0;i<2;i++){
  const a=new T.Group();this.axles.push(a);this.root.add(a);rod(a,black,[-.12,0,0],[.12,0,0],.009);
  const diff=mesh(new T.SphereGeometry(.022,24,16),black,a);diff.scale.set(1,.8,1.1);
  const cover=mesh(new T.CylinderGeometry(.017,.017,.005,12),red,a,[0,0,.018]);cover.rotation.x=Math.PI/2;
  for(const x of [-.112,.112])box(a,black,[.021,.028,.027],[x,-.002,0]);
  for(let j=0;j<6;j++){const angle=j*Math.PI/3;const b=mesh(new T.SphereGeometry(.002,6,4),steel,a,[Math.cos(angle)*.014,Math.sin(angle)*.014,.022]);b.name='differential bolt';}
 }
 for(let i=0;i<12;i++){const l=mesh(new T.CylinderGeometry(i<8?.0025:.004,i<8?.0025:.004,1,10),steel,this.root);this.links.push(l);}
 this.update([.065,.065,.065,.065],0,[0,0,0,0]);
 }
 createWheel(rubber:T.Material,steel:T.Material,black:T.Material){
  const w=new T.Group(),rotation=new T.Group();w.add(rotation);rotation.name='spin';
  const profile=[new T.Vector2(.030,-.022),new T.Vector2(.045,-.023),new T.Vector2(.054,-.018),new T.Vector2(.056,-.01),new T.Vector2(.056,.01),new T.Vector2(.054,.018),new T.Vector2(.045,.023),new T.Vector2(.030,.022),new T.Vector2(.030,-.022)];
  const tyre=mesh(new T.LatheGeometry(profile,56),rubber,rotation);tyre.rotation.z=Math.PI/2;
  const tread=new T.InstancedMesh(new T.BoxGeometry(.013,.006,.012),rubber,40*3);const mat=new T.Matrix4(),q=new T.Quaternion(),sc=new T.Vector3(1,1,1);let k=0;
  for(let row=-1;row<=1;row++)for(let j=0;j<40;j++){
   const a=(j+(row===0?.5:0))*Math.PI/20;q.setFromEuler(new T.Euler(a,0,row*.3));mat.compose(new T.Vector3(row*.014,Math.cos(a)*.057,-Math.sin(a)*.057),q,sc);tread.setMatrixAt(k++,mat);
  }tread.castShadow=true;rotation.add(tread);
  const hub=mesh(new T.CylinderGeometry(.030,.030,.041,32),black,rotation);hub.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
   const ring=mesh(new T.TorusGeometry(.028,.003,8,40),this.rim,rotation,[side*.024,0,0]);ring.rotation.y=Math.PI/2;
   for(let j=0;j<16;j++){const a=j*Math.PI/8;mesh(new T.SphereGeometry(.0018,6,5),steel,rotation,[side*.026,Math.cos(a)*.028,Math.sin(a)*.028]);}
   for(let j=0;j<6;j++){const a=j*Math.PI/3;rod(rotation,this.rim,[side*.022,Math.cos(a)*.008,Math.sin(a)*.008],[side*.022,Math.cos(a+.16)*.024,Math.sin(a+.16)*.024],.003);}
   const cap=mesh(new T.CylinderGeometry(.008,.008,.048,6),steel,rotation);cap.rotation.z=Math.PI/2;
  }return w;
 }
 update(lengths:number[],steer:number,rotations:number[]){
  for(let i=0;i<4;i++){
   const [x,,z]=wheelPositions[i];const y=.065-lengths[i];const w=this.wheels[i];w.position.set(x,y,z);w.rotation.y=i<2?steer:0;w.children[0].rotation.x=rotations[i];
   const spring=this.springs[i];const start=new T.Vector3(x*.65,.06,z*.92),end=new T.Vector3(x,y+.01,z);spring.position.copy(end);const delta=start.sub(end);spring.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());spring.scale.y=delta.length()/.065;
  }
  for(let a=0;a<2;a++){
   const left=this.wheels[a*2].position,right=this.wheels[a*2+1].position,axle=this.axles[a];axle.position.copy(left).add(right).multiplyScalar(.5);axle.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),right.clone().sub(left).normalize());
   for(let j=0;j<4;j++){const side=j%2===0?-1:1;this.connect(this.links[a*4+j],new T.Vector3(side*(j<2?.06:.03),.02,a===0?.035:-.035),new T.Vector3(side*(j<2?.10:.045),axle.position.y,axle.position.z));}
   this.connect(this.links[8+a],new T.Vector3(0,.025,0),axle.position);
  }
  this.connect(this.links[10],this.wheels[0].position.clone().add(new T.Vector3(0,0,.015)),this.wheels[1].position.clone().add(new T.Vector3(0,0,.015)));
  this.connect(this.links[11],new T.Vector3(-.05,.04,.15),this.wheels[1].position.clone().add(new T.Vector3(0,0,.015)));
 }
 connect(o:T.Mesh,a:T.Vector3,b:T.Vector3){const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
 setTyres(radius:number){this.radius=radius;for(const w of this.wheels)w.scale.setScalar(radius/.059);}
}
