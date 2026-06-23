let selectedRoute = 'alquoz';
let engine, scene, car, camera;
let speed = 0, score = 100, faults = 0, distance = 0;
let steering = 0, accelerating = false, braking = false;
let leftSignal = false, rightSignal = false, mirrorChecked = false;
let started = false, cameraMode = 0, currentStep = 0, failed = false;
let touchAccel=false, touchBrake=false, joyX=0, lastFault=0;
const faultLog = [];

const routes = {
  alquoz: {
    name:'Al Quoz', sky:[0.62,0.78,0.95], ground:'#d5bb86', road:'#24272b', accent:'#d8c2a7', water:false,
    intro:'Al Quoz inspired route: industrial streets, warehouses, flyover, signals and roundabout.',
    landmarks:['WAREHOUSE','GARAGE','DRIVING SCHOOL','FLYOVER','SERVICE ROAD'],
    steps:[
      {z:10,text:'Move off safely: mirror, right indicator, then accelerate.',need:'mirrorRight',penalty:'Moved off without mirror check and right indicator'},
      {z:58,text:'Traffic signal ahead. Red/yellow means stop before line; green means proceed.',need:'signalSafe',penalty:'Crossed signal without safe stop decision',major:true},
      {z:115,text:'Change to the left lane: mirror first, then left indicator.',need:'mirrorLeft',penalty:'Changed lane left without mirror and left indicator'},
      {z:185,text:'Bridge/flyover zone: keep lane, maintain speed under 50.',need:'speed50',penalty:'Too fast or unstable on bridge'},
      {z:260,text:'Roundabout ahead: slow down below 30 and signal right before exit.',need:'roundabout',penalty:'Roundabout exit without slowing and right indicator'},
      {z:350,text:'Service road: keep right lane and avoid road edge.',need:'rightLane',penalty:'Did not keep correct right lane on service road'},
      {z:455,text:'Final parking: slow down and stop safely on the right side.',need:'park',penalty:'Did not stop safely for final parking'}
    ]
  },
  alqusais: {
    name:'Al Qusais', sky:[0.70,0.82,0.98], ground:'#c8c6b8', road:'#262a2f', accent:'#cfd8dc', water:false,
    intro:'Al Qusais inspired route: residential blocks, school zone, signals, lane discipline and U-turn practice.',
    landmarks:['RESIDENTIAL','SCHOOL ZONE','METRO SIDE','MOSQUE','U-TURN'],
    steps:[
      {z:10,text:'Move off from residential street: mirror, right indicator, accelerate smoothly.',need:'mirrorRight',penalty:'Moved off without mirror check and right indicator'},
      {z:70,text:'School zone: slow to 30 km/h.',need:'speed30',penalty:'Speed too high in school zone'},
      {z:140,text:'Signal ahead: stop on red/yellow, proceed on green only.',need:'signalSafe',penalty:'Crossed signal without safe stop decision',major:true},
      {z:215,text:'Prepare U-turn from correct left lane: mirror + left signal.',need:'mirrorLeft',penalty:'Prepared U-turn from wrong routine; mirror/left signal missing'},
      {z:295,text:'After U-turn/turning area: signal right before exiting back to lane.',need:'rightSignal',penalty:'No right signal after turning/exit'},
      {z:390,text:'Residential road: keep lane and avoid sudden steering.',need:'laneStable',penalty:'Poor lane discipline in residential area'},
      {z:500,text:'Finish: brake and stop inside the finish box.',need:'park',penalty:'Did not stop safely at finish'}
    ]
  },
  portjumeirah: {
    name:'Port Jumeirah', sky:[0.48,0.75,0.96], ground:'#ead29d', road:'#23272c', accent:'#f0dfc0', water:true,
    intro:'Port Jumeirah inspired route: coastal road, palm-lined streets, merging, bridge and signal control.',
    landmarks:['COASTAL ROAD','MARINA SIDE','PALM WALK','MERGE','BRIDGE'],
    steps:[
      {z:10,text:'Move off near coastal road: mirror, right indicator, accelerate smoothly.',need:'mirrorRight',penalty:'Moved off without mirror check and right indicator'},
      {z:80,text:'Merge area: mirror check and left indicator before joining lane.',need:'mirrorLeft',penalty:'Merged without mirror and left indicator'},
      {z:155,text:'Traffic signal ahead: red/yellow stop, green proceed.',need:'signalSafe',penalty:'Crossed signal without safe stop decision',major:true},
      {z:235,text:'Bridge zone: maintain lane, speed below 50.',need:'speed50',penalty:'Too fast or poor lane control on bridge'},
      {z:315,text:'Coastal curve: keep smooth steering and speed below 40.',need:'speed40',penalty:'Too fast for coastal curve'},
      {z:420,text:'Roundabout/exit style junction: slow down and right signal before exit.',need:'roundabout',penalty:'Exit without correct roundabout routine'},
      {z:535,text:'Finish: stop safely near the right curb.',need:'park',penalty:'Did not stop safely at finish'}
    ]
  }
};

function $(id){return document.getElementById(id)}

document.querySelectorAll('.route').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.route').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedRoute=btn.dataset.route;});
$('startBtn').onclick=()=>{$('loadingScreen').style.display='none';started=true;init();};

function init(){
  const canvas=$('gameCanvas');
  engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  scene=new BABYLON.Scene(engine);
  const route=routes[selectedRoute];
  scene.clearColor=new BABYLON.Color4(route.sky[0],route.sky[1],route.sky[2],1);
  camera=new BABYLON.FollowCamera('FollowCam',new BABYLON.Vector3(0,8,-16),scene);
  camera.radius=16;camera.heightOffset=7;camera.rotationOffset=180;camera.cameraAcceleration=.08;camera.maxCameraSpeed=22;
  const hemi=new BABYLON.HemisphericLight('h',new BABYLON.Vector3(0,1,0),scene);hemi.intensity=.9;
  const sun=new BABYLON.DirectionalLight('sun',new BABYLON.Vector3(-.5,-1,.45),scene);sun.intensity=.75;
  createWorld(route);createCar();camera.lockedTarget=car;setupControls();
  $('routeName').textContent=route.name;updateInstruction(route.intro);setNextTask(route.steps[0].text);
  engine.runRenderLoop(()=>{if(!failed)updateGame();scene.render();});
  window.addEventListener('resize',()=>engine.resize());
}
function mat(name,color){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(color);return m;}
function createBox(name,w,h,d,x,y,z,color){const mesh=BABYLON.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=mat(name+Math.random(),color);return mesh;}
function createWorld(route){
  const ground=BABYLON.MeshBuilder.CreateGround('ground',{width:96,height:650},scene);ground.position.z=285;ground.material=mat('ground',route.ground);
  if(route.water){const sea=createBox('sea',25,.05,650,-44,.03,285,'#1577b8');}
  const road=createBox('mainRoad',18,.08,610,0,.02,290,route.road);
  [-8.9,8.9].forEach(x=>createBox('edge',.18,.12,610,x,.11,290,'#ffffff'));
  for(let z=-10;z<590;z+=15){createBox('centerDash',.22,.14,7,0,.14,z,'#f5d142');createBox('laneDashL',.12,.13,6,-4.5,.14,z,'#ffffff');createBox('laneDashR',.12,.13,6,4.5,.14,z,'#ffffff');}
  [58,140,155].forEach(z=>{createBox('stopline',17,.15,.6,0,.16,z,'#ffffff');createTrafficLight(-10.5,z+2);createTrafficLight(10.5,z+2);});
  createFlyover(route);createRoundabout(route);createFinishBox(route);
  for(let i=0;i<34;i++){const side=i%2?-1:1;const z=i*18+10;createBuilding(side*(23+Math.random()*12),z,route.accent,route.landmarks[i%route.landmarks.length]);if((route.water||i%3===0))createPalm(side*12.5,z+5);}
  for(let i=0;i<18;i++)createNpcCar((i%4<2?2.4:-6.2),35+i*28,i%3===0);
  createSign('START',-7,0);createSign('50',7,185);createSign('30',7,75);createSign('FINISH',-7,550);
}
function createTrafficLight(x,z){const pole=createBox('pole',.18,5,.18,x,2.5,z,'#333333');const box=createBox('tlbox',1.15,2.25,.5,x,5,z,'#111111');['#e51d25','#f5d142','#29d657'].forEach((c,i)=>{const s=BABYLON.MeshBuilder.CreateSphere('light',{diameter:.48},scene);s.position.set(x,5.65-i*.68,z-.28);s.material=mat('light'+x+z+i,c);});}
function createFlyover(route){const deck=createBox('flyover',22,.35,42,0,.5,205,'#52575f');deck.position.y=.35;[-11,11].forEach(x=>createBox('flyrail',.3,1.1,42,x,1.05,205,'#d8d8d8'));}
function createRoundabout(route){const torus=BABYLON.MeshBuilder.CreateTorus('roundabout',{diameter:17,thickness:.65},scene);torus.position.set(0,.2,275);torus.rotation.x=Math.PI/2;torus.material=mat('curb','#e8e8e8');const island=BABYLON.MeshBuilder.CreateCylinder('island',{diameter:9,height:.25},scene);island.position.set(0,.22,275);island.material=mat('island',route.ground);createPalm(0,275);}
function createFinishBox(route){createBox('finishBox',7,.12,16,5,.17,555,'#2ecc71');createBox('finishCurb',.35,.4,25,8.8,.35,555,'#eeeeee');}
function createBuilding(x,z,color,label){const h=5+Math.random()*13;const b=createBox('building',6+Math.random()*5,h,5+Math.random()*5,x,h/2,z,color);if(Math.random()>.52){const sign=createBox('sign',5,.8,.12,x,h+.7,z-2.8,'#123b5d');}}
function createPalm(x,z){const trunk=BABYLON.MeshBuilder.CreateCylinder('trunk',{height:5,diameter:.35},scene);trunk.position.set(x,2.5,z);trunk.material=mat('trunk','#8b5a2b');const top=BABYLON.MeshBuilder.CreateSphere('palm',{diameter:2.8},scene);top.position.set(x,5.3,z);top.scaling.y=.45;top.material=mat('leaf','#197b30');}
function createNpcCar(x,z,blue){const body=createBox('npc',2.25,.75,4.1,x,.45,z,blue?'#305cc9':'#dddddd');const roof=createBox('npcroof',1.5,.65,1.8,x,1.15,z-.25,'#18283a');}
function createSign(text,x,z){const post=createBox('post',.15,2.8,.15,x,1.4,z,'#333333');const board=createBox('board',2.2,1.1,.15,x,3,z,'#0b4f8a');}
function createCar(){
  car=new BABYLON.TransformNode('car',scene);
  const body=createBox('body',2.6,.9,4.7,0,.65,0,'#d71920');body.parent=car;
  const hood=createBox('hood',2.4,.35,1.5,0,1.02,1.25,'#c3161d');hood.parent=car;
  const cabin=createBox('cabin',1.7,.9,1.9,0,1.35,-.45,'#101c2e');cabin.parent=car;
  [[-1.35,.35,1.45],[1.35,.35,1.45],[-1.35,.35,-1.55],[1.35,.35,-1.55]].forEach((p,i)=>{const w=BABYLON.MeshBuilder.CreateCylinder('wheel'+i,{diameter:.76,height:.38},scene);w.rotation.z=Math.PI/2;w.position.set(p[0],p[1],p[2]);w.material=mat('wheel','#101010');w.parent=car;});
  car.position.set(-2.5,0,0);
}
function setupControls(){
  const keys={};
  window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key==='ArrowLeft')keys.a=true;if(e.key==='ArrowRight')keys.d=true;if(e.key==='ArrowUp')keys.w=true;if(e.key==='ArrowDown')keys.s=true;});
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.key==='ArrowLeft')keys.a=false;if(e.key==='ArrowRight')keys.d=false;if(e.key==='ArrowUp')keys.w=false;if(e.key==='ArrowDown')keys.s=false;});
  setInterval(()=>{accelerating=!!keys.w||touchAccel;braking=!!keys.s||touchBrake;steering=((keys.a?-1:0)+(keys.d?1:0))||joyX;},30);
  bindHold('accelBtn',()=>{touchAccel=true;accelerating=true},()=>{touchAccel=false;accelerating=false});bindHold('brakeBtn',()=>{touchBrake=true;braking=true},()=>{touchBrake=false;braking=false});
  $('mirrorBtn').onclick=()=>{mirrorChecked=true;updateInstruction('Mirror/head-check done. Now signal and move only when safe.');addScore(2);};
  $('leftInd').onclick=()=>{leftSignal=!leftSignal;rightSignal=false;paintSignals();};$('rightInd').onclick=()=>{rightSignal=!rightSignal;leftSignal=false;paintSignals();};
  $('resetBtn').onclick=()=>location.reload();$('cameraBtn').onclick=()=>{cameraMode=(cameraMode+1)%3;camera.radius=[16,24,9][cameraMode];camera.heightOffset=[7,14,4.3][cameraMode];};setupJoystick();
}
function bindHold(id,down,up){const el=$(id);el.onpointerdown=e=>{el.setPointerCapture?.(e.pointerId);down();};el.onpointerup=up;el.onpointercancel=up;el.onmouseleave=up;}
function paintSignals(){$('leftInd').style.background=leftSignal?'#10b981':'#26384e';$('rightInd').style.background=rightSignal?'#10b981':'#26384e';}
function setupJoystick(){const joy=$('joystick'),stick=$('stick');let active=false,rect;const move=(x,y)=>{const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;let dx=x-cx,dy=y-cy;const max=38,dist=Math.min(max,Math.hypot(dx,dy)),ang=Math.atan2(dy,dx);dx=Math.cos(ang)*dist;dy=Math.sin(ang)*dist;stick.style.transform=`translate(${dx}px,${dy}px)`;joyX=dx/max;};joy.addEventListener('pointerdown',e=>{active=true;rect=joy.getBoundingClientRect();joy.setPointerCapture(e.pointerId);move(e.clientX,e.clientY)});joy.addEventListener('pointermove',e=>{if(active)move(e.clientX,e.clientY)});joy.addEventListener('pointerup',()=>{active=false;joyX=0;stick.style.transform='translate(0,0)'});}
function updateGame(){
  const dt=engine.getDeltaTime()/1000, route=routes[selectedRoute];
  if(accelerating)speed+=24*dt;if(braking)speed-=44*dt;speed-=5.5*dt;speed=Math.max(0,Math.min(75,speed));
  const turn=(speed/42)*steering*dt*2.05;car.rotation.y+=turn;
  const forward=new BABYLON.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));car.position.addInPlace(forward.scale(speed*dt*.45));
  car.position.z=Math.max(car.position.z,-5);distance=Math.max(distance,car.position.z);
  if(Math.abs(car.position.x)>8.4){car.position.x=Math.sign(car.position.x)*8.4;speed*=.92;fault('Minor','Touched road edge / curb','Keep the vehicle inside lane boundaries.',3);}
  if(Math.abs(car.rotation.y)>.65 && speed>20) fault('Minor','Sharp steering at speed','Steer smoothly, especially during test.',2);
  const step=route.steps[currentStep];
  if(step && distance>step.z){if(!checkRequirement(step.need)){step.major?majorFail(step.penalty):fault('Minor',step.penalty,explain(step.need),10);}currentStep++;mirrorChecked=false;if(route.steps[currentStep])setNextTask(route.steps[currentStep].text);else pass();}
  liveZoneChecks(route);
  $('speed').textContent=Math.round(speed);$('score').textContent=Math.max(0,Math.round(score));$('faults').textContent=faults;$('progress').textContent=Math.min(100,Math.round(distance/560*100));
}
function liveZoneChecks(route){
  const z=distance;const cycle=Math.floor(Date.now()/1000)%14;const isGreen=cycle>=6&&cycle<=12;
  const inSignal=(Math.abs(z-58)<4||Math.abs(z-140)<4||Math.abs(z-155)<4);
  if(inSignal&&!isGreen&&speed>8)majorFail('Red/yellow signal crossed without stopping before the white line.');
  if(z>65&&z<95&&speed>34)fault('Minor','School/residential zone speed too high','Slow down around schools, pedestrians and residential roads.',4);
  if(z>250&&z<290&&speed>32)fault('Minor','Too fast near roundabout','Approach roundabouts slowly and be ready to give way.',4);
  if(z>180&&z<240&&speed>52)fault('Minor','Bridge/flyover speed too high','Maintain lane and controlled speed on bridges.',4);
  if(score<=40||faults>=10)majorFail('Too many accumulated faults. Examiner intervention.');
}
function checkRequirement(req){
  switch(req){
    case 'mirrorRight':return mirrorChecked&&rightSignal;
    case 'mirrorLeft':return mirrorChecked&&leftSignal;
    case 'rightSignal':return rightSignal;
    case 'signalSafe':return true;
    case 'speed30':return speed<=34;
    case 'speed40':return speed<=42;
    case 'speed50':return speed<=52&&Math.abs(car.position.x)<7.4;
    case 'roundabout':return speed<=32&&rightSignal;
    case 'rightLane':return car.position.x>0.5;
    case 'laneStable':return Math.abs(car.position.x)<7.4;
    case 'park':return speed<6&&car.position.x>2.5;
    default:return true;
  }
}
function explain(req){return {mirrorRight:'Before moving, do MSS: mirror, signal, shoulder/head check, then move.',mirrorLeft:'For lane change, check mirror/head-check first, then indicator, then move gradually.',speed30:'Reduce speed early in school/residential zones.',speed40:'Slow down before curves.',speed50:'Keep stable lane and controlled speed on bridge/flyover.',roundabout:'Approach slowly, use correct lane, and signal right before exit.',rightLane:'For normal driving/exit, keep the correct right lane unless instructed otherwise.',park:'Brake smoothly and stop near the right curb/finish box.'}[req]||'Follow the examiner instruction.';}
function fault(type,title,tip,points){const now=Date.now();if(now-lastFault<1200&&title!== 'Touched road edge / curb')return;lastFault=now;faults++;score-=points;faultLog.unshift({type,title,tip,at:Math.round(distance),points});updateFaultPanel();updateInstruction(`${type} fault: ${title}`);}
function addScore(p){score=Math.min(120,score+p)}
function updateInstruction(t){$('instruction').textContent=t;}
function setNextTask(t){$('nextTask').textContent='Next: '+t;updateInstruction(t);}
function updateFaultPanel(){const list=$('faultList');if(!faultLog.length){list.textContent='No faults yet. Drive smoothly.';return;}list.innerHTML=faultLog.slice(0,5).map(f=>`<div class="faultItem"><b>${f.type}</b> - ${f.title}<br><span>${f.at}m: ${f.tip}</span></div>`).join('');}
function majorFail(reason){if(failed)return;failed=true;faultLog.unshift({type:'Major',title:reason,tip:'Major faults cause immediate fail in this simulator.',at:Math.round(distance),points:0});showResult('❌ FAIL',reason);}
function pass(){if(failed)return;failed=true;showResult('✅ PASS','Route complete. Review your driving report below.');}
function showResult(title,text){$('resultModal').classList.remove('hidden');$('resultTitle').textContent=title;$('resultText').textContent=`${text} Score: ${Math.round(score)}, Faults: ${faults}`;$('finalFaults').innerHTML=faultLog.length?faultLog.map(f=>`<div class="finalFault"><b>${f.type}</b> at ${f.at}m: ${f.title}<br><small>${f.tip}</small></div>`).join(''):'<p>No faults recorded. Excellent drive.</p>';}
window.addEventListener('mouseup',()=>{if(!touchAccel)accelerating=false;if(!touchBrake)braking=false;});
