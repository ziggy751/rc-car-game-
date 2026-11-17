import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-800.css';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Crawler} from './vehicle';
import {Park,groundHeight,trails} from './world';
import {Simulation} from './physics';
import {loadState,saveState} from './state';
import {UI} from './ui';
import {batchStatic} from './optimize';
import './style.css';

async function boot(){
 const state=loadState();const ui=new UI(state);await RAPIER.init();
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.getElementById('scene')!.append(renderer.domElement);
 const scene=new T.Scene();const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;scene.environmentIntensity=.40;pmrem.dispose();
 const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.008,240);camera.position.set(.95,.55,1.15);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.minDistance=.28;orbit.maxDistance=3;orbit.maxPolarAngle=Math.PI*.47;orbit.target.set(0,.13,0);orbit.enabled=false;
 const world=new RAPIER.World({x:0,y:-9.81,z:0});const park=new Park(scene,world);const car=new Crawler();scene.add(car.root);
 batchStatic(car.shell);batchStatic(car.mechanics);for(const w of car.wheels)batchStatic(w.children[0]);for(const a of car.axles)batchStatic(a);for(const s of car.springs)batchStatic(s);
 // Keep the vegetation branch independently visible for quality presets.
 batchStatic(park.vegetation);park.vegetation.removeFromParent();batchStatic(park.group);park.group.add(park.vegetation);batchStatic(park.garage);
 const sim=new Simulation(world,state.tune);sim.applyTune();let camMode=0,accumulator=0,previous=performance.now(),fpsTime=0,frames=0,gate=0,challenge=false,sessionStarted=false;let garageYaw=0;const keys=new Set<string>();const target=new T.Vector3(),desired=new T.Vector3(),offset=new T.Vector3();let audio:AudioContext|null=null,osc:OscillatorNode|null=null,gain:GainNode|null=null;
 const persist=()=>{if(!saveState(state))ui.toast('Storage unavailable. Changes will last for this session only.');};
 function quality(){const q=state.tune.quality;const ratio=q==='Low'?.8:q==='Medium'?1:q==='High'?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,2);renderer.setPixelRatio(ratio);renderer.shadowMap.enabled=q!=='Low';park.sun.castShadow=q!=='Low';park.vegetation.visible=q!=='Low';renderer.setSize(innerWidth,innerHeight);}
 function applyTune(){sim.applyTune();car.setTyres(state.tune.radius);car.paint.color.set(state.tune.paint);car.shell.visible=state.tune.body;quality();persist();}
 applyTune();ui.onTune=applyTune;ui.onSave=persist;
 function startAudio(){if(!audio){audio=new AudioContext();osc=audio.createOscillator();osc.type='triangle';gain=audio.createGain();gain.gain.value=0;osc.connect(gain).connect(audio.destination);osc.start();}void audio.resume();}
 ui.onSound=()=>{state.tune.audio=!state.tune.audio;if(state.tune.audio)startAudio();document.getElementById('sound')!.setAttribute('aria-pressed',String(state.tune.audio));if(ui.mode==='settings')ui.render();persist();ui.toast(state.tune.audio?'Electric motor audio on':'Audio off');};
 ui.onMode=(mode)=>{
  sim.paused=mode!=='trail';keys.clear();orbit.enabled=mode==='garage';
  if(mode==='garage'){car.root.position.set(60,.389,0);car.root.quaternion.identity();car.update([.065,.065,.065,.065],0,[0,0,0,0]);orbit.target.set(60,.53,0);camera.position.set(60.82,.83,1.02);orbit.minDistance=.25;orbit.maxDistance=2.2;orbit.update();}
  else if(mode==='trail'){camera.position.copy(car.root.position.x>50?new T.Vector3(sim.body.translation().x+.8,sim.body.translation().y+.5,sim.body.translation().z+1):camera.position);}
 };
 ui.onRecover=()=>{const p=sim.body.translation();sim.reset(p.x,p.z);ui.toast('Crawler recovered. Find your next line.');};
 ui.onStart=()=>{const tr=trails[ui.activeTrail];sim.reset(tr.x,tr.z);sessionStarted=true;challenge=ui.activeTrail===0;gate=0;sim.elapsed=0;ui.toast(challenge?'Fern Creek · pass all 4 numbered gates':'Free crawl · explore your line');};
 ui.onTeleport=i=>{const tr=trails[i];sim.reset(tr.x,tr.z);challenge=false;gate=0;sessionStarted=true;ui.started=true;ui.toast('Travelled to '+tr.name);};
 const cameraNames=['Chase camera','Low RC camera','Body camera','Orbit camera'];
 ui.onCamera=()=>{camMode=(camMode+1)%4;orbit.enabled=camMode===3;if(camMode===3){orbit.target.copy(car.root.position).add(new T.Vector3(0,.1,0));orbit.minDistance=.3;orbit.maxDistance=3;}document.getElementById('camera')!.innerHTML='<kbd>C</kbd> '+cameraNames[camMode];};
 ui.onPhoto=()=>{if(ui.mode!=='trail'&&ui.mode!=='garage')return;ui.photo=!ui.photo;document.body.classList.toggle('photo',ui.photo);sim.paused=ui.photo||ui.mode!=='trail';orbit.enabled=ui.photo||ui.mode==='garage'||camMode===3;orbit.target.copy(car.root.position).add(new T.Vector3(sessionStarted?0:-.17,.13,0));keys.clear();};
 document.getElementById('download-photo')!.onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='ridgebound-'+Date.now()+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
 const blocked=(e:KeyboardEvent)=>e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement;
 window.addEventListener('keydown',e=>{if(blocked(e))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyR'&&ui.mode==='trail')ui.onRecover();if(e.code==='KeyC'&&ui.mode==='trail')ui.onCamera();if(e.code==='KeyG')ui.setMode(ui.mode==='garage'?'trail':'garage');if(e.code==='KeyM')ui.setMode(ui.mode==='map'?'trail':'map');if(e.code==='KeyP')ui.onPhoto();if(e.code==='Escape'){if(ui.photo)ui.onPhoto();else ui.setMode('trail');}
 if(state.tune.audio)startAudio();
 });window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();previous=performance.now();accumulator=0;});
 document.querySelectorAll<HTMLElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key!);});
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
 const axisAngle=()=>{const up=new T.Vector3(0,1,0).applyQuaternion(car.root.quaternion);const right=new T.Vector3(1,0,0).applyQuaternion(car.root.quaternion);return Math.atan2(right.y,up.y)*180/Math.PI;};
 function animate(now:number){
  requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.06);previous=now;accumulator+=dt;fpsTime+=dt;frames++;
  let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
  const pad=navigator.getGamepads?.()[0];if(pad){if(Math.abs(pad.axes[0])>.09)steer=-pad.axes[0];const trigger=(pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0);if(Math.abs(trigger)>.02)throttle=trigger;}
  if((throttle||steer)&&!sessionStarted&&ui.mode==='trail'){sessionStarted=true;ui.started=true;ui.render();}
  while(accumulator>=1/120){sim.step(1/120,{throttle,steer,brake:keys.has('Space')});accumulator-=1/120;}
  if(!sessionStarted)sim.elapsed=0;
  if(ui.mode!=='garage'){
   car.root.position.copy(sim.body.translation() as T.Vector3);car.root.quaternion.copy(sim.body.rotation() as T.Quaternion);
   car.update([0,1,2,3].map(i=>sim.controller.wheelSuspensionLength(i)??state.tune.ride),sim.steer,[0,1,2,3].map(i=>sim.controller.wheelRotation(i)??0));
  }
  if(ui.mode==='garage'||ui.photo||camMode===3){orbit.update();}
  else if(ui.mode==='trail'){
   target.copy(car.root.position).add(new T.Vector3(sessionStarted?0:-.17,.13,0));
   if(!sessionStarted){garageYaw+=dt*.025;offset.set(.54+Math.sin(garageYaw)*.03,.29,.71);}
   else if(camMode===0)offset.set(.57,.46,-.86).applyQuaternion(car.root.quaternion);
   else if(camMode===1)offset.set(.4,.18,-.55).applyQuaternion(car.root.quaternion);
   else offset.set(0,.235,.055).applyQuaternion(car.root.quaternion);
   desired.copy(car.root.position).add(offset);desired.y=Math.max(desired.y,groundHeight(desired.x,desired.z)+.09);camera.position.lerp(desired,1-Math.exp(-dt*4));
   if(camMode===2){target.copy(car.root.position).add(new T.Vector3(0,.19,1).applyQuaternion(car.root.quaternion));camera.position.copy(desired);}
   camera.lookAt(target);
  }
  if(challenge&&ui.mode==='trail'&&gate<4){
   const z=.8+gate*2.05,x=Math.sin(z*.42)*.65;const p=sim.body.translation();
   if(Math.hypot(p.x-x,p.z-z)<.34){gate++;if(gate===4){challenge=false;const first=!state.completed.includes(0);if(first){state.completed.push(0);state.credits+=150;persist();ui.render();}ui.toast(first?'Fern Creek complete · +150 trail credits':'Fern Creek complete · trail already rewarded');}else ui.toast('Gate '+gate+' / 4 · keep finding your line');}
  }
  document.getElementById('center-hint')!.textContent=challenge?'FERN CREEK / GATE '+(gate+1)+' OF 4':ui.photo?'':sim.contacts===0&&sessionStarted?'NO WHEEL CONTACT · R TO RECOVER':'';
  if(audio&&osc&&gain){const volume=state.tune.audio&&ui.mode==='trail'?.012*Math.abs(sim.throttle):0;gain.gain.setTargetAtTime(volume,audio.currentTime,.08);osc.frequency.setTargetAtTime(100+Math.abs(sim.controller.currentVehicleSpeed())*450+Math.abs(sim.throttle)*120,audio.currentTime,.08);}
  const p=car.root.position;park.update(now/1000,p.x>50?new T.Vector3():p);
  renderer.render(scene,camera);
  if(fpsTime>.25){
   document.getElementById('speed')!.textContent=(Math.hypot(sim.body.linvel().x,sim.body.linvel().z)*3.6).toFixed(1);document.getElementById('surface')!.textContent=sim.surface;document.getElementById('roll')!.textContent=Math.round(axisAngle())+'°';document.getElementById('time')!.textContent=String(Math.floor(sim.elapsed/60)).padStart(2,'0')+':'+String(Math.floor(sim.elapsed%60)).padStart(2,'0');
   document.querySelectorAll('#contacts i').forEach((el,i)=>el.classList.toggle('off',!sim.controller.wheelIsInContact(i)));document.getElementById('fps')!.textContent=Math.round(frames/fpsTime)+' FPS';fpsTime=0;frames=0;
  }
 }
 (window as any).__RIDGEBOUND__={sim,car,park,ui,state,renderer,scene,camera};
 document.getElementById('loading')!.classList.add('done');requestAnimationFrame(animate);
}
boot().catch(error=>{console.error(error);const loading=document.getElementById('loading');if(loading){loading.innerHTML='<span class="brand">RIDGEBOUND</span><span>Could not start the renderer. Check WebGL 2 support and reload.</span>';}});
