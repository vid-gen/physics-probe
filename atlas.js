/* Animated model atlas, adapted from the standalone paper exhibit. */
(() => {
  "use strict";

/* Original optical atlas. All geometry is drawn locally; each canvas owns its still plates. */
const drawAtlasRing = (() => {
  "use strict";

  const TAU = Math.PI * 2;
  const UP = -Math.PI / 2;
  const STEP = TAU / 8;
  const cache = new WeakMap();
  const cap = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const x = cap(value); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((n, i) => Math.round(lerp(n, b[i], t)));
  const ink = (rgb, alpha = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const rgb = hex => {
    let raw = String(hex || "ecc791").replace("#", "");
    if (raw.length === 3) raw = raw.split("").map(c => c + c).join("");
    const n = parseInt(raw, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [236,199,145];
  };

  function arc(g, radius, start, end, stroke, width = 1) {
    g.beginPath(); g.arc(0, 0, radius, start, end);
    g.strokeStyle = stroke; g.lineWidth = width; g.stroke();
  }
  function line(g, a, b, color, width = 1) {
    g.beginPath(); g.moveTo(...a); g.lineTo(...b);
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }
  function sector(g, inner, outer, a, b, fill) {
    g.beginPath(); g.arc(0,0,outer,a,b); g.arc(0,0,inner,b,a,true);
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  function radial(g, inner, outer, stops) {
    const gradient = g.createRadialGradient(0,0,inner,0,0,outer);
    for (const [x, color] of stops) gradient.addColorStop(x, color);
    return gradient;
  }
  function flare(g, x, y, r, color, alpha) {
    if (alpha <= 0) return;
    const grad = g.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0, ink(color, alpha));
    grad.addColorStop(.16, ink(color, alpha*.64));
    grad.addColorStop(.48, ink(color, alpha*.16));
    grad.addColorStop(1, ink(color, 0));
    g.fillStyle = grad; g.fillRect(x-r, y-r, r*2, r*2);
  }
  function plate(size, render) {
    const bitmap = document.createElement("canvas");
    bitmap.width = bitmap.height = size;
    const g = bitmap.getContext("2d");
    g.setTransform(size/1000,0,0,size/1000,size/2,size/2);
    render(g);
    return bitmap;
  }

  function housing(g) {
    // A blackened optical bed, turned fine radial grooves, and a fluted inner lip.
    const material = radial(g, 194, 417, [
      [0,"rgba(12,25,39,0)"], [.08,"rgba(14,29,39,.40)"], [.105,"#35424a"],
      [.12,"#111d29"], [.15,"#101b27"], [.48,"#152531"], [.82,"#111b26"],
      [.89,"#23323c"], [.915,"#111822"], [.977,"#151f2c"], [1,"rgba(12,25,37,0)"]
    ]);
    sector(g,194,417,0,TAU,material);
    const metal = g.createLinearGradient(-360,-350,310,280);
    for (const [stop,c] of [[0,"#aebfc0"],[.18,"#415969"],[.34,"#1c303c"],
      [.49,"#7f8b89"],[.57,"#b5966e"],[.68,"#3b4750"],[.86,"#233744"],[1,"#7d8e92"]]) metal.addColorStop(stop,c);
    for (const [r,w] of [[218,1],[224,2.2],[231,1.5],[396,1.6],[403,3],[409,1]]) {
      arc(g,r,0,TAU,metal,w);
    }
    for(let i=0;i<19;i++) arc(g,238+i*8.45,0,TAU,i%3===0?"#273846":"#1f2c38",.65);
    for(let i=0;i<288;i++) {
      const angle=UP+i*TAU/288;
      const major=i%12===0;
      line(g,polar(225.8,angle),polar(major?234:229.6,angle),major?"#a7b0a9":"#607079",major?1.25:.86);
    }
    // The inboard guide vanes are clocked against the fabric, so motion reveals parallax.
    for(let i=0;i<64;i++){
      const a=i*TAU/64;
      g.beginPath(); g.moveTo(...polar(232,a));
      g.quadraticCurveTo(...polar(288,a-.075),...polar(381,a+.10));
      g.strokeStyle=i%4===0?"rgba(148,169,177,.29)":"rgba(112,143,151,.17)";
      g.lineWidth=i%4===0?1.2:.7; g.stroke();
    }
  }

  // Three continuous, counterwoven tapes share a toroidal bed. Altitude determines
  // occlusion as well as the axial projection, producing actual over/under crossings.
  const textiles = [
    {dark:[22,49,67], mid:[93,165,178], glint:[228,255,248], phase:.16, spread:.98},
    {dark:[63,44,40], mid:[197,144,95], glint:[255,240,201], phase:2.24, spread:.90},
    {dark:[33,48,72], mid:[130,161,191], glint:[242,247,255], phase:4.27, spread:1.07}
  ];
  function strand(angle, band, lane) {
    const m = textiles[band], f = lane - .5;
    const twist = 3*angle + .39*Math.sin(2*angle-.45) + m.phase
      + f * m.spread + .12*f*Math.cos(5*angle + m.phase);
    const ridge = 307 + 7*Math.sin(2*angle-.4) + 5*Math.sin(5*angle+.15);
    const radius = ridge + (64 + 6*Math.sin(angle*2+.64)) * Math.cos(twist)
      + 5*f*Math.sin(angle*4-m.phase);
    const height = Math.sin(twist);
    const c=Math.cos(angle), s=Math.sin(angle);
    return {x: radius*c + 9*height, y:radius*s - 21*height, z:height, twist};
  }

  function braid(g) {
    const slices=80, lanes=43, steps=5;
    g.lineCap="round"; g.lineJoin="round";
    const panels=[];
    for(let k=0;k<slices;k++){
      const a=TAU*k/slices, sweep=TAU/slices;
      const mid=a+sweep/2;
      for(let band=0;band<textiles.length;band++){
        panels.push({a,sweep,mid,band,z:strand(mid,band,.5).z});
      }
    }
    // Axial projection shifts neighboring panels into one another's angular bins.
    // Sort all three tapes together to keep the crossing edges continuous.
    panels.sort((x,y)=>x.z-y.z);
    for(const {a,sweep,mid,band} of panels) {
        const m=textiles[band];
        const center=strand(mid,band,.5);
        // A shadowed ribbon below the threads keeps dark passages legible on the black bed.
        g.beginPath();
        for(let i=0;i<=steps;i++){
          const p=strand(a+sweep*i/steps,band,0);
          if(i===0)g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y);
        }
        for(let i=steps;i>=0;i--){
          const p=strand(a+sweep*i/steps,band,1); g.lineTo(p.x,p.y);
        }
        g.closePath(); g.fillStyle=ink(m.dark,.88); g.fill();
        for(let j=-3;j<lanes+3;j++){
          const f=j/(lanes-1);
          const flying=j<0||j>=lanes;
          const actualLane=flying?(f<0?f*3.9:1+(f-1)*3.9):f;
          const ridge=(.5+.5*Math.sin(j*2.39+.32))* .18;
          const spec = Math.pow(.5 + .5*Math.cos(center.twist + (f-.5)*m.spread - .85
            + .58*Math.cos(mid-.65)), 2.3);
          const incidence = .5 + .5*Math.cos(mid*2+.7);
          const causticLane=.48+.34*Math.sin(2*mid+m.phase)+.10*Math.sin(5*mid-.5*m.phase);
          const caustic=Math.exp(-Math.pow((f-causticLane)/.13,2))
              * (.45+.55*Math.pow(.5+.5*Math.cos(mid*2-.65),.8));
          const edge=Math.max(0,1-Math.min(Math.abs(f),Math.abs(1-f))/.083);
          const level=cap(.16+.43*spec+.15*incidence+ridge+.51*caustic+.25*edge+((j%9===0)?.10:0));
          let col=mix(m.dark,m.mid,Math.min(level*1.56,1));
          col=mix(col,m.glint,cap((level-.60)*2.55));
          if(j%5===0&&!flying)col=mix(col,m.dark,.32);
          g.beginPath();
          for(let i=0;i<=steps;i++){
            const p=strand(a+sweep*(i/steps),band,actualLane);
            if(i===0)g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y);
          }
          g.strokeStyle=ink(col,flying?(j%2===0?.55:.37):.73+level*.27);
          g.lineWidth=flying?.88:j===0||j===lanes-1?1.75:j%7===0?1.35:.82;
          g.stroke();
        }
    }
  }

  function scales(g,counts) {
    const edge=g.createLinearGradient(-380,-215,307,320);
    for(const [p,c] of [[0,"#7b8c90"],[.19,"#314754"],[.42,"#b5b6a4"],
      [.59,"#676b64"],[.76,"#344750"],[1,"#7c9299"]])edge.addColorStop(p,c);
    for(let n=0;n<8;n++){
      const a=UP+n*STEP, start=a-STEP*.47, end=a+STEP*.47;
      arc(g,414,start,end,edge,1.25);
      arc(g,425,a+STEP*.10,end,"rgba(177,193,187,.46)",1.05);
      arc(g,425,start,a-STEP*.10,"rgba(177,193,187,.46)",1.05);
      const pins=counts[n]||0;
      for(let i=0;i<pins;i++){
        const angle=a+(i-(pins-1)/2)*.025;
        line(g,polar(388.5,angle),polar(397,angle),"#0d1a27",3.2);
        line(g,polar(388.5,angle),polar(396.2,angle),"#aeb6a5",1.8);
      }
      for(let i=-13;i<=13;i++){
        const t=a+i*STEP/30;
        const isIndex=Math.abs(i)%5===0;
        line(g,polar(407.5,t),polar(isIndex?414:410.8,t),
          isIndex?"rgba(198,205,189,.88)":"rgba(150,168,171,.61)",isIndex?1.35:.9);
      }
      const bridge=a+STEP/2;
      g.save(); g.rotate(bridge);
      g.fillStyle="#253745"; g.strokeStyle="#889898"; g.lineWidth=.9;
      g.beginPath(); g.moveTo(398,-4.8);g.lineTo(411,-4.8);
      g.lineTo(417,0);g.lineTo(411,4.8);g.lineTo(398,4.8);g.closePath();g.fill();g.stroke();
      line(g,[402,-2],[407,-2],"#d7c6a6",1.15);
      g.restore();
    }
  }

  function renderPlate(g, bitmap, scale=1, rotation=0) {
    g.save();g.rotate(rotation);g.scale(scale,scale);
    g.drawImage(bitmap,-500,-500,1000,1000);g.restore();
  }
  function reflectedLight(g,angle,focusColor,intensity) {
    const sweep=.24;
    const point=polar(340,angle);
    g.save();
    g.beginPath(); g.arc(0,0,398,angle-sweep,angle+sweep);
    g.arc(0,0,233,angle+sweep,angle-sweep,true);g.closePath();g.clip();
    g.globalCompositeOperation="screen";
    flare(g,point[0],point[1],94,focusColor,.15*intensity);
    g.restore();
  }
  function glidingFibers(g,time,rotation){
    g.save(); g.rotate(rotation); g.globalCompositeOperation="screen";
    for(let i=0;i<9;i++) {
      const band=i%3, lane=.09+(i%4)*.22;
      const a=time*(.19+(i%3)*.035) + i*2.39996;
      const wave=.62+.38*Math.cos(a*2.5-.7*i);
      const color=textiles[band].glint;
      for(let j=0;j<5;j++){
        g.beginPath();
        for(let k=0;k<=4;k++) {
          const p=strand(a+(j+k/4)*.034,band,lane);
          if(k===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
        }
        g.lineWidth=1.4;g.strokeStyle=ink(color,wave*(j+1)/9);g.stroke();
      }
      const h=strand(a+.17,band,lane);flare(g,h.x,h.y,4.7,color,.45*wave);
    }
    g.restore();
  }

  function orbitLight(g, angle, direction, color, motion, time) {
    const hot=mix(color,[255,244,216],.69);
    const tail=.16+motion*.78, r=425;
    g.save();g.lineCap="round";g.globalCompositeOperation="screen";
    for(let i=0;i<24;i++){
      const p=i/24, q=(i+1)/24;
      const a=angle-direction*tail*(1-p), b=angle-direction*tail*(1-q);
      const bright=q*q;
      arc(g,r,Math.min(a,b),Math.max(a,b),ink(color,.04+.29*bright),3+5*bright);
      arc(g,r,Math.min(a,b),Math.max(a,b),ink(hot,.04+.84*bright),.8+1.8*bright);
    }
    const h=polar(r,angle);
    flare(g,...h,15+15*motion,hot,.70);
    // A local radial caustic, rather than a full-screen bloom, marks the active slot.
    const innerPoint=polar(391,angle);
    flare(g,...innerPoint,12+6*motion,hot,.38);
    arc(g,396,angle-.035,angle+.035,ink(hot,.7),2.2);
    g.beginPath();g.arc(...h,2.5+motion,0,TAU);g.fillStyle=ink([255,251,235],1);g.fill();
    if(motion>.001){
      for(let i=0;i<4;i++){
        const aa=angle-direction*(.008+i*.012);
        const outer=polar(416+i*1.8,aa);
        const inner=polar(250+12*i,aa-direction*.045);
        const grad=g.createLinearGradient(...inner,...outer);
        grad.addColorStop(0,ink(color,0));
        grad.addColorStop(.6,ink(color,motion*.09));
        grad.addColorStop(1,ink(hot,motion*(.48-i*.07)));
        line(g,inner,outer,grad,1.1+(3-i)*.42);
      }
    } else {
      const breath=.5+.5*Math.sin(time*1.65);
      arc(g,420.5,angle-.055,angle+.055,ink(color,.31+.28*breath),1);
    }
    g.restore();
  }

  function caustic(g, angle, color, power) {
    if(power < .007) return;
    g.save();
    g.rotate(angle);
    g.globalCompositeOperation="screen";
    // A hot specular line lands on the outer race and reflects inward through the glass.
    g.save();g.translate(406,0);g.scale(.46,1.85);
    flare(g,0,0,64,color,power*.64);
    g.restore();
    const beam=g.createLinearGradient(230,0,432,0);
    beam.addColorStop(0,ink(color,0));beam.addColorStop(.59,ink(color,power*.15));
    beam.addColorStop(.91,ink(color,power*.36));beam.addColorStop(1,ink(color,0));
    g.beginPath();g.moveTo(433,-1);g.lineTo(228,-49);g.lineTo(235,25);g.closePath();
    g.fillStyle=beam;g.fill();
    g.restore();
  }

  function arrival(g, angle, color, elapsed) {
    if(elapsed <= 0 || elapsed >= 1) return;
    const power=Math.sin(Math.PI*elapsed)*(1-.35*elapsed);
    g.save();g.rotate(angle);g.translate(425,0);
    g.globalCompositeOperation="screen";
    const warm=mix(color,[255,249,226],.57);
    const radius=18+41*(1-Math.pow(1-elapsed,2));
    arc(g,radius,-1.74,1.72,ink(color,power*.63),1.6);
    arc(g,radius*.90,-1.2,1.24,ink(warm,power*.39),1.15);
    for(let i=0;i<11;i++) {
      const bearing=-1.35+i*.27+.1*Math.sin(i*7.2);
      const distance=16+(19+(i*17)%42)*elapsed;
      const span=(2+(i*5)%10)*power;
      line(g,polar(distance-span,bearing),polar(distance+span,bearing),ink(warm,power*(.32+.40*(i%3)/2)),1.1);
    }
    flare(g,0,0,42,color,power*.70);
    g.restore();
  }

  return function drawAtlasRing(canvas, state) {
    const box=canvas.getBoundingClientRect();
    const width=Math.min(box.width,box.height);
    if(width<1)return;
    const pixels=Math.max(1,Math.round(width*Math.min(window.devicePixelRatio||1,2)));
    const counts=state.counts||[];
    const key=counts.join("/");
    let surface=cache.get(canvas);
    if(!surface||surface.pixels!==pixels||surface.key!==key){
      canvas.width=canvas.height=pixels;
      const quality=Math.min(1440,pixels);
      surface={pixels,key,base:plate(quality,housing),skin:plate(quality,braid),
        ticks:plate(quality,g=>scales(g,counts))};
      cache.set(canvas,surface);
    }
    const g=canvas.getContext("2d");
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,pixels,pixels);
    g.setTransform(pixels/1000,0,0,pixels/1000,pixels/2,pixels/2);
    const intro=state.reduced?1:cap(state.intro??1);
    const time=state.reduced?0:(state.time||0);
    const from=state.from??0, focus=state.focus??0;
    const change=state.reduced?1:cap(state.transition??1);
    let delta=(focus-from+8)%8;
    if(delta>=4)delta-=8;
    const movement=smooth(change);
    const angle=UP+(from+delta*movement)*STEP;
    const color=mix(rgb(state.colors?.[from]),rgb(state.colors?.[focus]),movement);
    const impulse=Math.abs(delta)>0?Math.sin(Math.PI*change):0;
    const base=smooth(intro/.65), fabric=smooth((intro-.05)/.91), lock=smooth((intro-.11)/.89);
    const drift=time*.118+.095*Math.sin(time*.52);
    g.globalAlpha=base;
    renderPlate(g,surface.base,.80+.20*base,-.48*(1-base));
    g.save();
    if(fabric<.999){
      g.beginPath();g.moveTo(0,0);
      g.arc(0,0,490,UP-.15,UP-.15+TAU*fabric);g.closePath();g.clip();
    }
    g.globalAlpha=cap(fabric*2.9);
    const spin=drift-.76*(1-fabric);
    renderPlate(g,surface.skin,.85+.15*fabric,spin);
    if(fabric>.63)glidingFibers(g,time,spin);
    g.restore();
    g.globalAlpha=lock;
    renderPlate(g,surface.ticks,1+.12*(1-lock),.52*(1-lock));
    reflectedLight(g,angle,color,.60+impulse*1.6);
    caustic(g,angle,color,.20+impulse*.79);
    if(intro<.995&&fabric>.015){
      const lead=UP-.15+TAU*fabric;
      const spark=polar(339,lead);
      flare(g,...spark,39,[238,208,161],Math.sin(Math.PI*fabric)*.73);
      line(g,polar(230,lead),polar(396,lead),"rgba(237,213,179,.66)",1.8);
      const burst=Math.sin(Math.PI*fabric);
      caustic(g,lead,[254,200,138],burst);
      orbitLight(g,lead,1,[232,182,110],burst*.85,time);
    }
    orbitLight(g,angle,Math.sign(delta)||-1,color,impulse,time);
    if(!state.reduced) arrival(g,UP+focus*STEP,color,state.landing??1);
    g.globalAlpha=1;
  };
})();

const atlasSpecimen = (() => {
  const ink = 'currentColor';
  const f = value => Number(value.toFixed(2));
  const path = (d, opacity = 1, weight = 1, fill = 'none', extra = '') =>
    `<path d="${d}" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${weight}" fill="${fill}" ${extra}/>`;
  const line = (x1, y1, x2, y2, opacity = .6, weight = .65) =>
    path(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, opacity, weight);
  const dot = (x, y, r = 1, opacity = 1) =>
    `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${ink}" opacity="${opacity}"/>`;
  const ellipse = (cx, cy, rx, ry, opacity, weight = .65, rotation = 0) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${cx} ${cy})" fill="none" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${weight}"/>`;
  const rep = (count, draw) => Array.from({ length: count }, (_, i) => draw(i)).join('');
  const curve = (count, point) => rep(count, i => {
    const [x, y] = point(i / (count - 1));
    return `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  });
  const poly = points => points.map(([x,y],i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('') + 'Z';
  const image = () => {
    const rims = rep(3, i => {
      const x = 32 + i * 8, y = 25 - i * 4;
      return path(poly([[x,y],[x+81,y-11],[x+91,y+43],[x+10,y+55]]), .26 + i * .3, i === 2 ? 1.1 : .65, ink, 'fill-opacity=".024"');
    });
    return rims + '<g transform="matrix(.97,-.135,.22,1,53,21)">' +
      path('M0 0H74V36H0Z',.5,.65) + dot(53,9,3,.85) +
      path('M0 28l13-9 8 5 14-17 16 19 7-9 16 12v7H0Z',.9,.9,ink,'fill-opacity=".075"') +
      path('M21 24l8-5 6-12 3 11 4-1 9 9m6-9 3 8 4-1',.7,.65) +
      rep(10, i => line(7+i*6,34,13+i*6,30+Math.sin(i)*2,.37,.5)) + '</g>';
  };
  const video = () => '<g transform="matrix(.99,-.13,.14,.98,15,28)">' +
    path('M0 0H145V48H0Z',.88,1,ink,'fill-opacity=".035"') +
    rep(22,i => path(`M${2+i*6.55} 2h3.1v2.2H${2+i*6.55}Zm0 41h3.1v2.2H${2+i*6.55}Z`,.55,.55,ink,'fill-opacity=".23"')) +
    rep(4,i => {
      const x=3+i*35.5, h=[29,21,16,18][i];
      return path(`M${x} 8h33v32h-33Z`,.75,.68) +
        path(`M${x+2} 35q9-2 15 0t14-1`,.38,.55) +
        ellipse(x+17,35,5.4,1.25,.42,.6) + dot(x+12+i*2,h,3.2,.9) +
        path(`M${x+6} ${h+4}l3-2m-2 5 3-2`,.5,.6);
    }) + '</g>';
  const generative = () => {
    const samples = (s, v) => {
      const x=35+116*s, centre=66-39*s-15*Math.sin(Math.PI*s);
      const width=22*Math.pow(Math.sin(Math.PI*s),.8);
      return [x+7*v*Math.sin(Math.PI*s),centre+width*v];
    };
    return path(curve(70,s=>samples(s,-1)),.88,.9) + path(curve(70,s=>samples(s,1)),.85,.9) +
      rep(22,i=>{
        const s=.035+i*.043;
        return path(curve(34,q=>samples(s+Math.sin(Math.PI*q)*.061,2*q-1)),.33+Math.sin(s*Math.PI)*.45,.6);
      }) +
      path(curve(70,s=>samples(s,.05)),.95,1.1) +
      path('M18 77l17-11 13-5',.82,1.12) +
      rep(14,i=>dot(135+(i*7%25),20+(i*19%34),i%3===0?.85:.6,.27+i%4*.13));
  };
  const world = () => {
    const rad=Math.PI/180, tilt=17*rad, cx=91, cy=45, r=31;
    const globe=(lat,lon)=>{
      const x=r*Math.cos(lat)*Math.sin(lon),y=-r*Math.sin(lat)*.94+r*Math.cos(lat)*Math.cos(lon)*.33;
      return [cx+x*Math.cos(tilt)-y*Math.sin(tilt),cy+x*Math.sin(tilt)+y*Math.cos(tilt)];
    };
    return ellipse(cx,cy,49,12,.33,.62,-22) +
      rep(7,i=>path(curve(81,q=>globe((-67.5+i*22.5)*rad,q*2*Math.PI)),.38,.53))+
      rep(12,i=>path(curve(61,q=>globe((q-.5)*Math.PI,i*Math.PI/6)),i<6?.78:.27,.63))+
      ellipse(cx,cy,r,r,.92,1) +
      path('M43 62C47 69 75 61 100 50S146 27 139 25',.9,1) +
      dot(130,34,1.7) + dot(46,61,1.05,.75);
  };
  const audio = () => {
    const signal=t=>{
      const env=.14+.87*Math.exp(-((t-.34)**2)/.009)+.77*Math.exp(-((t-.68)**2)/.022);
      return env*(Math.sin(18*Math.PI*t)+.3*Math.sin(38*Math.PI*t+.6));
    };
    return line(13,47,168,47,.33,.65) +
      rep(31,i=>line(15+i*5,67,15+i*5, i%5===0?72:69,.35,.5))+
      rep(4,i=>path(curve(220,q=>[14+151*q,46+i*1.2-19*signal(q+.0025*i)]),i===0?.98:.39-i*.07,i===0?1.05:.56))+
      path(curve(100,q=>[15+149*q,46-15*(.09+.94*Math.exp(-((q-.34)**2)/.012)+.7*Math.exp(-((q-.68)**2)/.022))]),.3,.52,'none','stroke-dasharray="1.7 2.3"');
  };
  const tactile = () => '<g transform="rotate(-17 90 44)">' + rep(16,i=>{
    const rx=3.3+i*2.35,ry=2+i*1.96;
    const angle0=-Math.PI*.12+Math.sin(i*.5)*.06, sweep=Math.PI*(i<4?1.55:1.86);
    return path(curve(112,t=>{
      const a=angle0 + sweep*t;
      const x=89+rx*Math.cos(a)*(1+.09*Math.sin(a*2))+.06*i;
      const y=46+ry*Math.sin(a)-2*Math.sin(a*2)+1.5*Math.cos(a*3)*i/15;
      return [x,y];
    }),.54+.43*(1-i/20),i%3===1?1:.65);
  })+ path('M94 49c10 0 15 4 20 10m-19-7c8 1 12 5 16 10m-17-7c7 2 10 6 13 10',.65,.7)+'</g>';
  const geometry = () => {
    const project=(row,col)=>{
      const x=(col-3)*9, z=(row-2.5)*8;
      const y=7+36*Math.exp(-((col-3.7)**2/3.4+(row-2)**2/2.9))+3*Math.sin(.9*col+row);
      return [90+x*1.28-z*.93,64+x*.25+z*.48-y];
    };
    let mesh='';
    for(let r=0;r<5;r++) for(let c=0;c<6;c++){
      const a=project(r,c),b=project(r,c+1),d=project(r+1,c+1),e=project(r+1,c);
      mesh+=path(poly([a,b,d]),.42,.6,ink,`fill-opacity="${f(.018+(r+c)%4*.026)}"`)+path(poly([a,d,e]),.56,.63);
    }
    return mesh+rep(6,r=>rep(7,c=>{const [x,y]=project(r,c);return dot(x,y,(r+c)%4===0?1.25:.71,.85);}));
  };
  const language = () => path('M18 47C30 35 44 28 60 32c9 2 19 7 28 15-12 12-23 18-35 18-12-1-24-7-35-18Z',.86,1.05,ink,'fill-opacity=".028"') +
    path('M20 44c18-22 44-25 69-3M22 50c18 23 46 23 66 .5',.42,.65) +
    ellipse(54,47,12.1,14,.95,.9) + ellipse(54,47,7.2,8.2,.65,.6) +
    rep(32,i=>{const a=i*Math.PI/16;return line(54+7.8*Math.cos(a),47+8.6*Math.sin(a),54+11.6*Math.cos(a),47+13.4*Math.sin(a),.6,.54);}) +
    dot(54,47,4.4,.83) +dot(56,44,1.4,1)+
    path('M89 47h12l12-16h9m-19 16h20m-26 2 15 14h10',.58,.72) +
    rep(3,i=>{
      const y=27+i*16;
      return dot(124,y+4,1,.8) + path(`M129 ${y+1}h${[19,27,21][i]}m-${[19,27,21][i]} 4h${[27,15,24][i]}m-${[27,15,24][i]} 4h${[12,21,15][i]}`,.78,.8);
    });
  const render = { image, video, generative, world, audio, tactile, geometry, language };
  return key => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 90" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">${render[key]?.() || ''}</svg>`;
})();

  const families = [
    { key:'image', label:'Image', color:'#ffb97c',
      models: ["DINOv2", "DINOv3", "MAE", "SigLIP 2", "I-JEPA"],
      icon:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 3 2 4-5 5 7"/>' },
    { key:'video', label:'Video', color:'#7ce5ce',
      models: ["V-JEPA 1", "V-JEPA 2", "V-JEPA 2.1", "VideoMAEv2", "VideoPrism"],
      icon:'<rect x="3" y="5" width="18" height="14" rx="1.3"/><path d="M6 5v14m12-14v14M3 9h3m-3 6h3m12-6h3m-3 6h3m-11-6 5 3-5 3z"/>' },
    { key:'generative', label:'Generative', color:'#f5a2ab',
      models: ["FLUX.1-schnell", "MiniMax-H3", "LTX-2.5"],
      icon:'<path d="M4 20c1-3 3-5 7-7m-5 5C5 11 11 5 20 3c-1 7-5 15-14 15ZM8 15l6-5M3 21h5"/>' },
    { key:'world', label:'World', color:'#b6a3ee',
      models: ["WoW-1-Wan", "Cosmos-Predict2.5"],
      icon:'<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8" transform="rotate(24 12 12)"/><path d="M3 16c3 2 15-3 18-8M8 21h8"/>' },
    { key:'audio', label:'Audio', color:'#e0a3e8',
      models: ["BEATs", "AudioMAE", "AST", "Whisper", "Qwen2.5-Omni"],
      icon:'<path d="M2.5 10v4m3-7v10m3.2-13v16m3.3-12v8m3.2-11v14m3.2-11v8m3.1-6v4"/>' },
    { key:'tactile', label:'Tactile', color:'#bfd684',
      models: ["SPARSH-DINO", "SPARSH-DINOv2", "SPARSH-MAE", "SPARSH-IJEPA", "SPARSH-VJEPA", "TVL", "UniTouch", "AnyTouch", "T3"],
      icon:'<path d="M3.5 12a8.5 8.5 0 0 1 17 0m-14.3 3c1-2 0-4 1.3-6a5.6 5.6 0 0 1 10 3c0 4-1 6-2.4 8m-6.9-1.5c2-2.7 1.4-4.3 1.7-6.7a2.4 2.4 0 0 1 4.8.2c0 4-.6 5.2-2.4 8.7M12 12c0 3-.5 4.5-1.1 5.5"/>' },
    { key:'geometry', label:'Geometry', color:'#94bdff',
      models: ["Video Depth Anything", "MoGe-2", "VGGT", "SAM3"],
      icon:'<path d="m12 2.4 8.8 5v9.5L12 22l-8.8-5.1V7.4Zm0 10.1v9.1m-8.6-14 8.6 4.9 8.6-4.9M7.7 5l8.7 5m-8.7 9.5V9.9"/>' },
    { key:'language', label:'Vision-language', color:'#f4cc76',
      models: ["Qwen3-VL"],
      icon:'<path d="M1.8 10.7C5.4 5 8.6 4 12 4s6.6 1 10.2 6.7C18.6 16 15 17.2 12 17.2S5.4 16 1.8 10.7Z"/><circle cx="12" cy="10.7" r="3.2"/><path d="M14.5 19.4h6m-4 2h4"/>' }
  ];

  // An unlabelled, stationary registration field makes rotation visible.
  function registrationField(chart) {
    const segments = [];
    let seed=839147;
    function random() { seed=(1664525*seed+1013904223)>>>0; return seed/4294967296; }
    for(let n=0;n<115;n++) {
      const x=16+568*random(), y=12+576*random();
      const r=Math.hypot(x-300,y-300);
      if(r<118 || (r>145 && r<247)) continue;
      const a=(.11+random()*.38).toFixed(2), radius=(.38+random()*.68).toFixed(2);
      segments.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+radius+'" opacity="'+a+'" fill="#d9ded2"/>');
    }
    for(const [x,y] of [[47,89],[554,119],[63,489],[530,502]]) {
      segments.push('<path d="M'+(x-4)+' '+y+'h8m-4-4v8" stroke="#a9bfc3" stroke-width=".7" opacity=".4"/>');
    }
    chart.innerHTML=segments.join('');
  }


  const forSlot = index => (families.length - index) % families.length;
  const byPosition = families.map((_,slot) => families[forSlot(slot)]);
  const colors = byPosition.map(f => f.color);
  const counts = byPosition.map(f => f.models.length);
  const introDuration = 1.7, dwell = 4.2, travel = .92;
  const clamp = x => Math.max(0, Math.min(1,x));
  const soften = x => { const t = clamp(x); return t*t*(3-2*t); };

  function mountAtlas(host, instance) {
    const panelId = 'atlas-family-'+instance;
    host.innerHTML = `
      <div class="atlas-body">
        <div class="atlas-field">
          <div class="atlas-dial">
            <svg class="atlas-marks" viewBox="0 0 600 600" aria-hidden="true" fill="none"><g></g></svg>
            <canvas aria-hidden="true"></canvas>
            <div class="atlas-core"><span class="atlas-number">30<span class="atlas-plus">+</span></span><span class="atlas-core-label">Foundation<br>models</span></div>
            <div class="atlas-stations" role="group" aria-label="Model families"></div>
          </div>
        </div>
        <div class="atlas-folio" id="${panelId}">
          <div class="atlas-specimen" aria-hidden="true"></div>
          <h2 class="atlas-title"></h2>
          <ul class="atlas-names" aria-label="Models"></ul>
        </div>
      </div>`;
    const dial = host.querySelector('.atlas-dial');
    const canvas = dial.querySelector('canvas');
    const stationGroup = dial.querySelector('.atlas-stations');
    const folio = host.querySelector('.atlas-folio');
    const title = folio.querySelector('.atlas-title');
    const specimen = folio.querySelector('.atlas-specimen');
    const names = folio.querySelector('.atlas-names');
    registrationField(dial.querySelector('.atlas-marks g'));

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let time = reduced.matches ? introDuration : 0;
    let visible = false, frame = 0, lastStamp = null;
    let previous = 0, target = 0, shown = -1, changedAt = -travel;
    let nextAt = introDuration+dwell;

    const stations = families.map((family,index) => {
      const angle = forSlot(index)*Math.PI/4 - Math.PI/2;
      const station = document.createElement('button');
      station.type = 'button';
      station.className = 'atlas-station';
      station.dataset.family = family.key;
      station.setAttribute('aria-controls', panelId);
      station.setAttribute('aria-label', 'Show '+family.label);
      station.title = family.label;
      station.style.setProperty('--tone',family.color);
      station.style.setProperty('--x',(50+42.5*Math.cos(angle))+'%');
      station.style.setProperty('--y',(50+42.5*Math.sin(angle))+'%');
      station.innerHTML = '<span class="atlas-socket"><svg viewBox="0 0 24 24" aria-hidden="true">'+family.icon+'</svg></span>';
      station.addEventListener('click',() => {
        time = Math.max(time,introDuration);
        if(index !== target) select(index);
        nextAt = time+dwell+travel;
        draw();
      });
      stationGroup.append(station);
      return station;
    });

    function select(index) {
      previous = target;
      target = index;
      changedAt = time;
    }
    function showFamily(index) {
      if(index===shown) return;
      shown = index;
      const family = families[index];
      host.style.setProperty('--atlas-active',family.color);
      title.textContent = family.label;
      title.classList.toggle('atlas-long',family.label.length>=10);
      specimen.innerHTML = atlasSpecimen(family.key);
      names.replaceChildren(...family.models.map(name => {
        const li = document.createElement('li');
        li.textContent = name;
        return li;
      }));
      stations.forEach((station,i) => station.setAttribute('aria-pressed',String(i===index)));
    }
    function draw() {
      const still = reduced.matches;
      const intro = still?1:clamp(time/introDuration);
      const phase = still?1:clamp((time-changedAt)/travel);
      const changing = target!==previous && phase<1;
      const outgoing = changing && phase<.42;
      showFamily(outgoing?previous:target);
      const fold = changing?(outgoing?soften(phase/.42):1-soften((phase-.42)/.58)):0;
      const entry = soften((intro-.22)/.78);
      folio.style.opacity = String(entry*(1-.93*fold));
      folio.style.transform = 'translateY('+((1-entry)*12+(outgoing?-1:1)*fold*9).toFixed(2)+'px)';
      dial.style.setProperty('--core-in',String(soften((intro-.15)/.55)));
      dial.style.setProperty('--station-in',String(soften((intro-.30)/.65)));
      const landing = target===previous?(time-introDuration+.1)/.84:(time-changedAt-travel+.12)/.84;
      drawAtlasRing(canvas,{time,intro,focus:forSlot(target),from:forSlot(previous),transition:phase,landing,colors,counts,reduced:still});
    }
    function tick(stamp) {
      frame = 0;
      if (!canRender()) return;
      if (reduced.matches) {
        draw();
        return;
      }
      if(lastStamp!==null) time+=Math.min(.15,Math.max(0,stamp-lastStamp)/1000);
      lastStamp = stamp;
      if(time>=nextAt) {
        // Keep a keyboard-selected record readable while the visitor is using the dial.
        if(!stationGroup.querySelector(':focus-visible')) select((target+1)%families.length);
        nextAt = time+dwell;
      }
      draw();
      frame = requestAnimationFrame(tick);
    }
    const root = document.documentElement;
    const coverShowing = () => !root.classList.contains('title-sequence') || root.classList.contains('cover-arriving');
    const canRender = () => visible && !document.hidden && coverShowing();
    function schedule() {
      cancelAnimationFrame(frame);
      lastStamp = null;
      if(!canRender()) return;
      draw();
      if(!reduced.matches) frame = requestAnimationFrame(tick);
    }
    if(root.classList.contains('title-sequence')) {
      const openingObserver = new MutationObserver(() => {
        if(!coverShowing()) return;
        openingObserver.disconnect();
        schedule();
      });
      openingObserver.observe(root,{attributes:true,attributeFilter:['class']});
    }
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }).observe(host);
    new ResizeObserver(() => { if(canRender()) draw(); }).observe(dial);
    document.addEventListener('visibilitychange',schedule);
    reduced.addEventListener('change',() => {
      time = Math.max(time,introDuration);
      schedule();
    });
    showFamily(0);
  }

  document.querySelectorAll('[data-model-atlas]').forEach(mountAtlas);
})();
