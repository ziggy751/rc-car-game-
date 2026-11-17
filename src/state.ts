import {defaults,type Tune} from './physics';
export type Save={version:1;tune:Tune;builds:{name:string;tune:Tune}[];completed:number[];credits:number};
export const SAVE_KEY='ridgebound.save.v1';
export function loadState(storage:Pick<Storage,'getItem'>=localStorage):Save{
 const base:Save={version:1,tune:{...defaults},builds:[],completed:[],credits:0};
 try{const data=JSON.parse(storage.getItem(SAVE_KEY)||'null');if(data?.version!==1)return base;
 const t=data.tune||{};const numeric=(v:unknown,a:number,b:number,f:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(a,Math.min(b,v)):f;
 base.tune={...defaults,compound:['soft','trail','hard'].includes(t.compound)?t.compound:defaults.compound,radius:numeric(t.radius,.052,.067,.059),spring:numeric(t.spring,25,95,55),damping:numeric(t.damping,2,10,5),ride:numeric(t.ride,.05,.085,.065),paint:/^#[0-9a-f]{6}$/i.test(t.paint)?t.paint:defaults.paint,motor:t.motor==='trail'?'trail':'torque',body:typeof t.body==='boolean'?t.body:true,quality:['Low','Medium','High','Ultra'].includes(t.quality)?t.quality:'High',audio:!!t.audio};
 base.completed=Array.isArray(data.completed)?data.completed.filter((x:unknown)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<4):[];base.credits=base.completed.length*150;
 base.builds=Array.isArray(data.builds)?data.builds.filter((b:any)=>typeof b?.name==='string'&&b?.tune).slice(0,8).map((b:any)=>({name:b.name.slice(0,40),tune:loadState({getItem:()=>JSON.stringify({version:1,tune:b.tune})}).tune})):[];
 return base;}catch{return base;}
}
export function saveState(state:Save,storage:Pick<Storage,'setItem'>=localStorage){try{storage.setItem(SAVE_KEY,JSON.stringify(state));return true;}catch{return false;}}
