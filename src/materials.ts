import * as T from 'three';
export const metal=(color:T.ColorRepresentation, roughness=.4, metalness=.75)=>new T.MeshStandardMaterial({color,roughness,metalness});
export function noiseTexture(kind:'rock'|'ground'|'bark'|'rubber'|'wood',size=256){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!;const image=ctx.createImageData(size,size);let seed=768;
 const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const n=rand();let v=0; let rgb=[1,1,1];
 if(kind==='rock'){
  const hash=(a:number,b:number)=>{const q=Math.sin(a*127.1+b*311.7)*43758.5453;return q-Math.floor(q);};
  const noise=(a:number,b:number)=>{const ax=Math.floor(a),by=Math.floor(b),fx=a-ax,fy=b-by;const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ax,by),hash(ax+1,by),sx),T.MathUtils.lerp(hash(ax,by+1),hash(ax+1,by+1),sx),sy);};
  let f=0;for(let o=0;o<5;o++)f+=noise(x/size*(5<<o),y/size*(5<<o))/(2<<o);
  const vein=Math.max(0,1-Math.abs(noise(x/size*9,y/size*9)-.5)*35);
  v=55+f*105+n*35+vein*35;rgb=[1.04,1.03,.96];
 }
 if(kind==='ground'){v=70+60*n+10*Math.sin(x*.13)*Math.sin(y*.19);rgb=[1.12,1,.72];}
 if(kind==='bark'){v=80+25*Math.sin(x*.7+Math.sin(y*.07))+35*n;rgb=[1,.87,.7];}
 if(kind==='rubber'){v=85+40*n;rgb=[1,1,1];}
 if(kind==='wood'){v=100+25*Math.sin(x*.22+Math.sin(y*.04))+15*n;rgb=[1.2,1,.7];}
 const i=(y*size+x)*4;image.data[i]=v*rgb[0];image.data[i+1]=v*rgb[1];image.data[i+2]=v*rgb[2];image.data[i+3]=255;
 }ctx.putImageData(image,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
}
export function label(text:string,color='#eee2c6',bg='transparent',size=256){const c=document.createElement('canvas');c.width=size;c.height=size/4;const x=c.getContext('2d')!;x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=color;x.font=`700 ${size/9}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,size/8);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide,depthWrite:false});}
export function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,pos=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...pos as [number,number,number]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent:T.Object3D,m:T.Material,s:number[],p:number[]){return mesh(new T.BoxGeometry(...s as [number,number,number]),m,parent,p);}
export function rod(parent:T.Object3D,m:T.Material,a:T.Vector3|number[],b:T.Vector3|number[],r=.004){const start=Array.isArray(a)?new T.Vector3(...a as [number,number,number]):a;const end=Array.isArray(b)?new T.Vector3(...b as [number,number,number]):b;const d=end.clone().sub(start);const o=mesh(new T.CylinderGeometry(r,r,d.length(),10),m,parent,start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
export function tube(parent:T.Object3D,m:T.Material,points:number[][],r=.003){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),32,r,6,false),m,parent);}
