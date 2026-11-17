import RAPIER from '@dimforge/rapier3d-compat';
import {wheelPositions} from './vehicle';
import {groundHeight} from './world';
export type Tune={compound:'soft'|'trail'|'hard';radius:number;spring:number;damping:number;motor:'torque'|'trail';ride:number;paint:string;body:boolean;quality:'Low'|'Medium'|'High'|'Ultra';audio:boolean};
export const defaults:Tune={compound:'soft',radius:.059,spring:55,damping:5,motor:'torque',ride:.065,paint:'#c48745',body:true,quality:'High',audio:false};
export class Simulation {
 body:RAPIER.RigidBody; controller:RAPIER.DynamicRayCastVehicleController;throttle=0;steer=0;elapsed=0;distance=0;surface='Dry granite';last={x:0,z:0};contacts=0;paused=false;
 constructor(public world:RAPIER.World,public tune:Tune){
  this.body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.3,0).setLinearDamping(.22).setAngularDamping(.65).setCcdEnabled(true).setCanSleep(false));
  // Low chassis mass plus lighter upper body: a meaningful, non-zero centre of gravity.
  world.createCollider(RAPIER.ColliderDesc.cuboid(.082,.032,.18).setTranslation(0,.018,0).setMass(2.8).setFriction(.5),this.body);
  world.createCollider(RAPIER.ColliderDesc.cuboid(.091,.052,.10).setTranslation(0,.185,-.04).setMass(.45).setFriction(.4),this.body);
  this.controller=world.createVehicleController(this.body);this.controller.indexUpAxis=1;this.controller.setIndexForwardAxis=2;
  for(const [x,,z]of wheelPositions)this.controller.addWheel({x,y:.065,z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},tune.ride,tune.radius);
  this.applyTune();this.reset();world.step();
 }
 applyTune(){for(let i=0;i<4;i++){
  const c=this.controller;c.setWheelRadius(i,this.tune.radius);c.setWheelSuspensionRestLength(i,this.tune.ride);c.setWheelMaxSuspensionTravel(i,.04);c.setWheelSuspensionStiffness(i,this.tune.spring*4);c.setWheelSuspensionCompression(i,this.tune.damping);c.setWheelSuspensionRelaxation(i,this.tune.damping*.8);c.setWheelMaxSuspensionForce(i,35);c.setWheelSideFrictionStiffness(i,1);
 }}
 reset(x=0,z=0){this.body.setTranslation({x,y:groundHeight(x,z)+.14,z},true);this.body.setRotation({x:0,y:0,z:0,w:1},true);this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);this.last={x,z};this.throttle=0;this.steer=0;}
 step(dt:number,input:{throttle:number;steer:number;brake:boolean}){
  if(this.paused)return;
  this.throttle+=(input.throttle-this.throttle)*Math.min(1,dt*5);if(input.throttle===0&&Math.abs(this.throttle)<.025)this.throttle=0;this.steer+=(input.steer*.56-this.steer)*Math.min(1,dt*7);
  const p=this.body.translation(),speed=this.controller.currentVehicleSpeed(),maxSpeed=this.tune.motor==='torque'?.65:1.1;
  this.surface=Math.abs(p.z-3.7)<.45?'Wet creek bed':Math.abs(p.x)<.8&&p.z>-.3&&p.z<2.6?'Dry granite':p.z>4.5?'Roots & loam':'Forest loam';
  const surfaceGrip=this.surface==='Wet creek bed'?.6:this.surface==='Roots & loam'?.9:1.15;
  const grip=surfaceGrip*(this.tune.compound==='soft'?1.65:this.tune.compound==='trail'?1.2:.85);
  for(let i=0;i<4;i++){
   const c=this.controller;
   c.setWheelSteering(i,i<2?this.steer:0);c.setWheelFrictionSlip(i,grip);
   // Torque rolls off with wheel speed rather than imposing a hard velocity clamp.
   const torque=(this.tune.motor==='torque'?3.1:2.4)*Math.max(0,1-Math.abs(speed)/maxSpeed);
   c.setWheelEngineForce(i,input.brake?0:this.throttle*torque);
   c.setWheelBrake(i,input.brake?.14:Math.abs(this.throttle)<.025?.025:0);
  }
  this.world.timestep=dt;this.controller.updateVehicle(dt,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);this.world.step();
  this.contacts=[0,1,2,3].filter(i=>this.controller.wheelIsInContact(i)).length;this.elapsed+=dt;
  const now=this.body.translation();this.distance+=Math.hypot(now.x-this.last.x,now.z-this.last.z);this.last={x:now.x,z:now.z};
  if(now.y< -5||Math.abs(now.x)>19||Math.abs(now.z)>19)this.reset();
 }
}
