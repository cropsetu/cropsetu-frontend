import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, StatusBar, Dimensions, Alert, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import {
  sendChatMessage, sendVoiceMessage,
  getConversationMessages, getConversations, getScanSessions,
} from '../../services/aiApi';
import { useFarm } from '../../context/FarmContext';
import { useMultiFarm } from '../../context/MultiFarmContext';
import { useLanguage } from '../../context/LanguageContext';
import { WebView } from 'react-native-webview';
import { COLORS } from '../../constants/colors';
import { SoundEffects } from '../../utils/sounds';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

const { width: W, height: H } = Dimensions.get('window');

const BG       = COLORS.surface;
const CHAT_BG  = COLORS.background;
const PRIMARY  = COLORS.primary;
const P_LIGHT  = COLORS.primaryLight;
const ACCENT   = COLORS.teal;
const A_LIGHT  = COLORS.tealMid;
const BORDER   = COLORS.border;
const SURFACE  = COLORS.surfaceSunken;
const TEXT     = COLORS.textDark;
const TEXT2    = COLORS.textBody;
const MUTED    = COLORS.textLight;
const USER_A   = COLORS.primary;
const USER_B   = COLORS.teal;
const DANGER   = COLORS.error;

// ─── Voice modal dark tokens ──────────────────────────────────────────────────
const V_BG    = COLORS.black;
const V_GLASS = 'rgba(34,197,94,0.07)';
const V_BORD  = 'rgba(34,197,94,0.18)';
const V_TEXT  = COLORS.greenMint;
const V_MUTED = 'rgba(134,239,172,0.55)';

// ─── Particle Word Sphere fills the entire modal screen ──────────────────────

// Minified HTML+JS for the particle word visualizer.
// Rendering pipeline: Fibonacci sphere (idle) → off-screen canvas text sampling
// → Fisher-Yates shuffled pixel targets → spring physics → perspective projection
// Messages accepted: {type:'listening',value:bool}, {type:'audioLevel',value:0-1},
//                    {type:'transcript',value:string}, {type:'reset'}
const PARTICLE_WORD_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:transparent;overflow:hidden;height:100vh;width:100vw;}
canvas{position:fixed;inset:0;width:100%;height:100%;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var canvas=document.getElementById('c');
  var ctx=canvas.getContext('2d');
  var W,H,CX,CY,dpr;
  var appState=0,isListening=false,audioLevel=0,t=0,rotY=0;
  var N=6000;
  var px=new Float32Array(N),py=new Float32Array(N),pz=new Float32Array(N);
  var vx=new Float32Array(N),vy=new Float32Array(N),vz=new Float32Array(N);
  var tx=new Float32Array(N),ty=new Float32Array(N),tz=new Float32Array(N);
  var hue=new Float32Array(N),phase=new Float32Array(N);
  var PHI=Math.PI*(1+Math.sqrt(5)),FOV=450,CAM=500;

  function resize(){
    dpr=window.devicePixelRatio||1;W=window.innerWidth;H=window.innerHeight;
    CX=W/2;CY=H/2;canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    ctx.scale(dpr,dpr);
    if(appState===0)initSphere();
  }

  function initSphere(){
    var R=Math.min(W,H)*0.35;
    for(var i=0;i<N;i++){
      var p=Math.acos(1-2*(i+0.5)/N),a=PHI*i;
      tx[i]=Math.sin(p)*Math.cos(a)*R;
      ty[i]=Math.sin(p)*Math.sin(a)*R;
      tz[i]=Math.cos(p)*R;
    }
  }

  function initParticles(){
    for(var i=0;i<N;i++){
      px[i]=(Math.random()-.5)*W*2;py[i]=(Math.random()-.5)*H*2;pz[i]=(Math.random()-.5)*800;
      vx[i]=vy[i]=vz[i]=0;hue[i]=120+(i/N)*55;phase[i]=Math.random()*Math.PI*2;
    }
  }

  function sampleText(phrase){
    var fW=Math.floor(W),fH=Math.floor(H);
    var off=document.createElement('canvas');off.width=fW;off.height=fH;
    var c2=off.getContext('2d');
    var words=phrase.split(' ');var lines=[];var cur='';
    var maxC=phrase.length>20?10:16;
    for(var wi=0;wi<words.length;wi++){
      var w=words[wi];
      if((cur+w).length>maxC){lines.push(cur.trim());cur=w+' ';}else cur+=w+' ';
    }
    lines.push(cur.trim());
    var fs=Math.min(fW*0.65/(maxC*0.5),fH*0.45/lines.length,140);
    if(phrase.length>25)fs*=0.8;
    c2.fillStyle='${COLORS.white}';c2.font='900 '+fs+'px Arial';c2.textAlign='center';c2.textBaseline='middle';
    var lh=fs*1.1,sy=fH/2-((lines.length-1)*lh/2);
    for(var li=0;li<lines.length;li++)c2.fillText(lines[li],fW/2,sy+li*lh);
    var d=c2.getImageData(0,0,fW,fH).data;
    var pts=[];var step=phrase.length>30?2:1;
    for(var y=0;y<fH;y+=step)for(var x=0;x<fW;x+=step)
      if(d[(y*fW+x)*4+3]>120)pts.push(x-fW/2+(Math.random()-.5)*.8,y-fH/2+(Math.random()-.5)*.8);
    for(var i=pts.length/2-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));var ia=i*2,ja=j*2;
      var tmp=pts[ia];pts[ia]=pts[ja];pts[ja]=tmp;
      tmp=pts[ia+1];pts[ia+1]=pts[ja+1];pts[ja+1]=tmp;
    }
    return pts;
  }

  function formWord(phrase){
    if(!phrase.trim())return;
    appState=1;
    var pts=sampleText(phrase);var pc=pts.length/2;
    for(var i=0;i<N;i++){var idx=(i%pc)*2;tx[i]=pts[idx];ty[i]=pts[idx+1];tz[i]=0;}
    rotY=0;
    setTimeout(function(){if(appState===1)appState=2;},2000);
  }

  function resetSphere(){appState=0;initSphere();}

  function update(){
    t+=0.005;
    if(appState===0)rotY+=isListening?0.012:0.006;
    var jitter=appState===0?(isListening?2.5+audioLevel*8:1.8):0;
    var breathe=appState===0&&isListening?Math.sin(t*3)*0.15:0;
    for(var i=0;i<N;i++){
      var bx=tx[i]*(1+breathe),by=ty[i]*(1+breathe),bz=tz[i]*(1+breathe);
      var cY2=Math.cos(rotY),sY2=Math.sin(rotY);
      var rx=bx*cY2-bz*sY2,ry=by,rz=bx*sY2+bz*cY2;
      if(appState===0){
        rx+=Math.sin(t*8+phase[i])*jitter;ry+=Math.cos(t*9+phase[i])*jitter;rz+=Math.sin(t*7+phase[i]*2)*jitter;
        if(isListening&&audioLevel>0.3){var f=(audioLevel-0.3)*6;rx+=Math.sin(phase[i]*3)*f;ry+=Math.cos(phase[i]*5)*f;}
      }
      var sp=appState===0?0.02:0.022;
      vx[i]+=(rx-px[i])*sp;vy[i]+=(ry-py[i])*sp;vz[i]+=(rz-pz[i])*sp;
      vx[i]*=0.82;vy[i]*=0.82;vz[i]*=0.82;
      px[i]+=vx[i];py[i]+=vy[i];pz[i]+=vz[i];
    }
  }

  function draw(){
    ctx.fillStyle='rgba(0,0,0,0.20)';ctx.fillRect(0,0,W,H);
    for(var i=0;i<N;i++){
      var z=pz[i]+CAM;if(z<10)continue;
      var sc=FOV/z,sx=px[i]*sc+CX,sy2=py[i]*sc+CY;
      var spd=Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]+vz[i]*vz[i]);
      var a=Math.min(1,(0.18+spd*0.1)*(sc*0.65));
      var sz=(0.4+spd*0.12)*sc;
      var h,s,l;
      if(appState>=1){h=142;s=90;l=75;a=Math.min(1,a*1.5);sz*=0.9;}
      else{
        h=(hue[i]+t*25)%360;
        s=isListening?85+audioLevel*15:80;l=isListening?65+audioLevel*20:70;
        if(isListening){a=Math.min(1,a*(1.2+audioLevel*0.8));sz*=(1+audioLevel*0.5);}
      }
      ctx.beginPath();ctx.arc(sx,sy2,sz,0,6.2832);
      ctx.fillStyle='hsla('+h+','+s+'%,'+l+'%,'+a+')';ctx.fill();
    }
    if(appState===0&&isListening){
      var gr=80+audioLevel*60;
      var grd=ctx.createRadialGradient(CX,CY,0,CX,CY,gr);
      grd.addColorStop(0,'rgba(22,163,74,'+(0.08+audioLevel*0.12)+')');
      grd.addColorStop(0.5,'rgba(13,148,136,'+(0.04+audioLevel*0.06)+')');
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath();ctx.arc(CX,CY,gr,0,6.2832);ctx.fillStyle=grd;ctx.fill();
    }
  }

  function loop(){update();draw();requestAnimationFrame(loop);}

  function onMsg(e){
    try{
      var raw=typeof e==='string'?e:(e.data||'');
      var d=JSON.parse(raw);
      if(d.type==='listening')isListening=d.value;
      if(d.type==='audioLevel')audioLevel=d.value;
      if(d.type==='transcript')formWord(d.value||'');
      if(d.type==='reset')resetSphere();
    }catch(err){}
  }
  document.addEventListener('message',onMsg);
  window.addEventListener('message',onMsg);

  resize();initParticles();loop();
  window.addEventListener('resize',function(){ctx.resetTransform();resize();});
})();
</script>
</body>
</html>`;

function ParticleWordSphere({ isListening, audioLevel, transcript }) {
  const wvRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    wvRef.current?.postMessage(JSON.stringify({ type: 'listening', value: isListening }));
  }, [isListening]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    wvRef.current?.postMessage(JSON.stringify({ type: 'audioLevel', value: audioLevel }));
  }, [audioLevel]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (transcript) {
      wvRef.current?.postMessage(JSON.stringify({ type: 'transcript', value: transcript }));
    } else {
      wvRef.current?.postMessage(JSON.stringify({ type: 'reset' }));
    }
  }, [transcript]);

  // WebView native module is not available on web preview — render a placeholder
  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: V_MUTED, fontSize: 12 }}>Voice sphere — run on device</Text>
    </View>;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={wvRef}
        source={{ html: PARTICLE_WORD_HTML }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        originWhitelist={['*']}
        backgroundColor="transparent"
        allowsInlineMediaPlayback
      />
    </View>
  );
}

// ─── Voice full-screen modal (slides up, dark bg so particles look great) ─────
function VoiceModal({ visible, isRecording, isPaused, isProcessing, audioLevel, recordDuration, voiceResult, onStart, onSend, onCancel, onPause, onClose, insets }) {
  const slideAnim   = useRef(new Animated.Value(H)).current;
  const transFade   = useRef(new Animated.Value(0)).current;
  const ring1Scale  = useRef(new Animated.Value(1)).current;
  const ring2Scale  = useRef(new Animated.Value(1)).current;
  const ring3Scale  = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.3)).current;
  const [mounted, setMounted] = useState(visible);

  // Slide in / out
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(slideAnim, { toValue: 0, speed: 16, bounciness: 0, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: H, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]);

  // Idle breathe loop — rings pulse gently when recording, freeze when paused
  useEffect(() => {
    if (!isRecording || isPaused) {
      Animated.parallel([
        Animated.timing(ring1Scale,  { toValue: 1,    duration: 400, useNativeDriver: true }),
        Animated.timing(ring2Scale,  { toValue: 1,    duration: 400, useNativeDriver: true }),
        Animated.timing(ring3Scale,  { toValue: 1,    duration: 400, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.25, duration: 400, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.timing(ringOpacity, { toValue: 0.7, duration: 300, useNativeDriver: true }).start();
    const a1 = Animated.loop(Animated.sequence([
      Animated.timing(ring1Scale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
      Animated.timing(ring1Scale, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
    ]));
    const a2 = Animated.loop(Animated.sequence([
      Animated.delay(250),
      Animated.timing(ring2Scale, { toValue: 1.3, duration: 800, useNativeDriver: true }),
      Animated.timing(ring2Scale, { toValue: 1.0, duration: 800, useNativeDriver: true }),
    ]));
    const a3 = Animated.loop(Animated.sequence([
      Animated.delay(500),
      Animated.timing(ring3Scale, { toValue: 1.45, duration: 900, useNativeDriver: true }),
      Animated.timing(ring3Scale, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
    ]));
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [isRecording, isPaused]);

  // Audio-reactive boost — rings surge on voice, shrink on silence
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const l = Math.max(0, audioLevel);
    Animated.parallel([
      Animated.timing(ring1Scale,  { toValue: 1.1 + l * 0.3,  duration: 90, useNativeDriver: true }),
      Animated.timing(ring2Scale,  { toValue: 1.2 + l * 0.45, duration: 90, useNativeDriver: true }),
      Animated.timing(ring3Scale,  { toValue: 1.35 + l * 0.6, duration: 90, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0.4 + l * 0.6,  duration: 90, useNativeDriver: true }),
    ]).start();
  }, [audioLevel]);

  // Error fade
  useEffect(() => {
    if (voiceResult?.error) Animated.timing(transFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    else transFade.setValue(0);
  }, [voiceResult]);

  if (!mounted) return null;

  const mins = Math.floor(recordDuration / 60).toString().padStart(2, '0');
  const secs = (recordDuration % 60).toString().padStart(2, '0');

  return (
    <Animated.View style={[VM.root, { transform: [{ translateY: slideAnim }] }]}>

      {/* ── Full-screen particle sphere (original center position) ── */}
      <ParticleWordSphere
        isListening={isRecording}
        audioLevel={audioLevel}
        transcript={voiceResult?.transcription || ''}
      />

      {/* ── Bottom scrim so controls are readable ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', COLORS.black]}
        locations={[0, 0.35, 0.7, 1]}
        style={VM.scrim}
        pointerEvents="none"
      />

      {/* ── Header overlay (top) ── */}
      <View style={[VM.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onClose} style={VM.closeBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={24} color={V_MUTED} />
        </TouchableOpacity>
        <Text style={VM.headerTitle}>Voice Assistant</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Error card ── */}
      {voiceResult?.error && !isRecording && !isProcessing && (
        <Animated.View style={[VM.resultCard, { opacity: transFade }]}>
          <Text style={VM.errorText}>⚠ {voiceResult.error}</Text>
          <TouchableOpacity style={VM.retryBtn} onPress={onStart} activeOpacity={0.8}>
            <Text style={VM.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Controls — firmly at bottom, never overlapping sphere ── */}
      <View style={[VM.controls, { paddingBottom: insets.bottom + 24 }]}>
        {isProcessing ? (
          <View style={VM.processingRow}>
            <ActivityIndicator color={P_LIGHT} size="small" />
            <Text style={VM.processingText}>Analysing…</Text>
          </View>
        ) : isRecording ? (
          <>
            {/* Status + timer */}
            <Text style={VM.listeningLabel}>{isPaused ? 'Paused' : 'Listening...'}</Text>
            <Text style={VM.bigTimer}>{mins}:{secs}</Text>

            {/* Three-button row: Cancel · Mic(Done) · Pause */}
            <View style={VM.threeRow}>

              {/* Cancel */}
              <View style={VM.sideBtnWrap}>
                <TouchableOpacity style={VM.cancelCircle} onPress={onCancel} activeOpacity={0.8}>
                  <Ionicons name="close" size={18} color={DANGER} />
                </TouchableOpacity>
                <Text style={VM.sideBtnLabel}>Cancel</Text>
              </View>

              {/* Center mic button (Done) with audio-reactive rings */}
              <View style={VM.micWrap}>
                <Animated.View style={[VM.ring3, {
                  opacity: ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                  transform: [{ scale: ring3Scale }],
                }]} />
                <Animated.View style={[VM.ring2, {
                  opacity: ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
                  transform: [{ scale: ring2Scale }],
                }]} />
                <Animated.View style={[VM.ring1, {
                  opacity: ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
                  transform: [{ scale: ring1Scale }],
                }]} />
                <TouchableOpacity style={VM.micBtn} onPress={onSend} activeOpacity={0.85}>
                  <LinearGradient
                    colors={isPaused ? [COLORS.gray550, COLORS.gray650] : [P_LIGHT, PRIMARY]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={VM.micGrad}
                  >
                    <Ionicons name="mic" size={26} color={COLORS.white} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Pause */}
              <View style={VM.sideBtnWrap}>
                <TouchableOpacity style={VM.pauseCircle} onPress={onPause} activeOpacity={0.8}>
                  <Ionicons name={isPaused ? 'play' : 'pause'} size={16} color={V_TEXT} />
                </TouchableOpacity>
                <Text style={VM.sideBtnLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </View>

            </View>
            <Text style={VM.doneHint}>Tap mic to send</Text>
          </>
        ) : voiceResult && !voiceResult.error ? (
          <View style={VM.successRow}>
            <Ionicons name="checkmark-circle" size={20} color={P_LIGHT} />
            <Text style={VM.successText}>Opening chat…</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Chat sub-components (light theme)
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    Animated.parallel(dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]))
    )).start();
  }, []);
  return (
    <View style={S.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[S.dot, { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }] }]} />
      ))}
    </View>
  );
}

function DiagnosisCard({ data, onBuyMedicine }) {
  const sevColor = { low: PRIMARY, moderate: COLORS.amber, high: COLORS.error, critical: COLORS.darkRed }[data.severity] || MUTED;
  const steps = Array.isArray(data.treatment)
    ? data.treatment
    : data.treatment && typeof data.treatment === 'object'
      ? Object.entries(data.treatment).filter(([, v]) => v).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
      : [];
  const note = data.prevention || data.expectedRecovery || data.additionalNotes || '';
  return (
    <View style={S.diagCard}>
      <View style={S.diagHeader}>
        <View style={[S.diagSevDot, { backgroundColor: sevColor }]} />
        <Text style={S.diagName}>{data.disease || data.name}</Text>
        <View style={[S.diagConf, { backgroundColor: `${sevColor}18` }]}>
          <Text style={[S.diagConfText, { color: sevColor }]}>{data.confidence}% match</Text>
        </View>
      </View>
      <View style={S.diagMeta}><Ionicons name="leaf-outline" size={12} color={MUTED} /><Text style={S.diagMetaText}>{data.crop ? `${data.crop} · ` : ''}{data.severity}</Text></View>
      <View style={S.diagDivider} />
      <Text style={S.diagSectionLabel}>Treatment Plan</Text>
      {steps.map((step, i) => (
        <View key={i} style={S.diagStep}>
          <View style={S.diagStepNum}><Text style={S.diagStepNumText}>{i + 1}</Text></View>
          <Text style={S.diagStepText}>{typeof step === 'string' ? step : step.action}</Text>
        </View>
      ))}
      {!!note && <View style={S.diagTip}><Ionicons name="shield-checkmark-outline" size={12} color={PRIMARY} /><Text style={S.diagTipText}>{note}</Text></View>}
      <TouchableOpacity style={S.buyBtn} onPress={onBuyMedicine} activeOpacity={0.8}>
        <LinearGradient colors={[USER_A, USER_B]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.buyBtnGrad}>
          <Ionicons name="cart-outline" size={14} color={COLORS.white} />
          <Text style={S.buyBtnText}>Buy Products</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function MarketCard({ data }) {
  const prices  = data.prices || [];
  const insight = data.insight || data.sellingAdvice || '';
  const metaRows = [
    data.msp         && { label: 'MSP',         value: data.msp },
    data.marketRange && { label: 'Market range', value: data.marketRange },
    data.trend       && { label: 'Trend',        value: data.trend },
    data.bestMarket  && { label: 'Best market',  value: data.bestMarket },
  ].filter(Boolean);
  return (
    <View style={S.mktCard}>
      <Text style={S.mktCrop}>{data.crop} Prices Today</Text>
      {prices.map((p, i) => <View key={i} style={S.mktRow}><Text style={S.mktMandi}>{p.mandi}</Text><Text style={S.mktPrice}>₹{(p.price || 0).toLocaleString()}</Text></View>)}
      {metaRows.map((r, i) => <View key={i} style={S.mktRow}><Text style={S.mktMandi}>{r.label}</Text><Text style={S.mktPrice}>{r.value}</Text></View>)}
      {!!insight && <View style={S.mktTip}><Ionicons name="bulb-outline" size={12} color={COLORS.amber} /><Text style={S.mktTipText}>{insight}</Text></View>}
    </View>
  );
}

// Format inline bold/text within a single line
function formatInline(line, baseStyle) {
  const parts = (line || '').split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return <Text style={baseStyle}>{line}</Text>;
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <Text key={i} style={{ fontWeight: '800' }}>{p.slice(2, -2)}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

// Render AI text with proper markdown-like formatting
function FormattedAIText({ text }) {
  const lines = (text || '').split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Empty line → small spacer
    if (!trimmed) {
      elements.push(<View key={i} style={{ height: 6 }} />);
      continue;
    }

    // Section header: line is fully bold like **Some Header**
    if (/^\*\*[^*]+\*\*[:\s]*$/.test(trimmed)) {
      const headerText = trimmed.replace(/^\*\*/, '').replace(/\*\*[:\s]*$/, '');
      elements.push(
        <View key={i} style={{ marginTop: i > 0 ? 10 : 0, marginBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT, lineHeight: 22 }}>{headerText}</Text>
        </View>
      );
      continue;
    }

    // Bullet point: starts with - or * or  (numbered: 1. 2. etc)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^(\d+)\.\s+(.+)/);
    if (bulletMatch) {
      const isNumbered = /^\d+\./.test(trimmed);
      const bulletContent = isNumbered ? bulletMatch[2] : bulletMatch[1];
      const bulletLabel = isNumbered ? `${bulletMatch[1]}.` : '\u2022';
      elements.push(
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 3, paddingLeft: 2 }}>
          <Text style={{ fontSize: 15, color: TEXT2, fontWeight: '500', width: isNumbered ? 22 : 14, lineHeight: 24 }}>{bulletLabel}</Text>
          <View style={{ flex: 1 }}>{formatInline(bulletContent, { fontSize: 15, color: TEXT, lineHeight: 24 })}</View>
        </View>
      );
      continue;
    }

    // Regular text line
    elements.push(
      <View key={i} style={{ marginTop: 1 }}>
        {formatInline(trimmed, { fontSize: 15, color: TEXT, lineHeight: 24 })}
      </View>
    );
  }

  return <View>{elements}</View>;
}

function MessageBubble({ msg, onBuyMedicine }) {
  const isUser = msg.role === 'user';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  if (isUser) {
    return (
      <Animated.View style={[S.userBubbleWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={S.userBubble}>
          {msg.isVoice && <View style={S.voiceTag}><Ionicons name="mic" size={10} color="rgba(255,255,255,0.65)" /><Text style={S.voiceTagText}>voice</Text></View>}
          <Text style={S.userBubbleText}>{msg.transcribing ? '…' : msg.text}</Text>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[S.aiBubbleWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={S.aiAvatar}><Ionicons name="leaf" size={14} color={PRIMARY} /></View>
      <View style={{ flex: 1, gap: 8 }}>
        {msg.text ? <View style={S.aiBubble}><FormattedAIText text={msg.text} /></View> : null}
        {msg.diagnosisData && <DiagnosisCard data={msg.diagnosisData} onBuyMedicine={onBuyMedicine} />}
        {msg.marketData    && <MarketCard data={msg.marketData} />}
      </View>
    </Animated.View>
  );
}

// ── Sidebar (light theme) ──────────────────────────────────────────────────
function Sidebar({ isOpen, onClose, sessions, historyLoading, onSessionPress, onNewChat, insets }) {
  const translateX     = useRef(new Animated.Value(-W * 0.82)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX,     { toValue: isOpen ? 0 : -W * 0.82, speed: 18, bounciness: 0, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: isOpen ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[SB.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[SB.panel, { paddingTop: insets.top + 12, transform: [{ translateX }] }]}>
        <View style={SB.panelHeader}>
          <View style={SB.panelTitleRow}>
            <LinearGradient colors={[USER_A, USER_B]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={SB.panelAvatar}>
              <Ionicons name="leaf" size={14} color={COLORS.white} />
            </LinearGradient>
            <Text style={SB.panelTitle}>FarmMind AI</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={SB.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={MUTED} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={SB.newChatBtn} onPress={() => { onNewChat(); onClose(); }} activeOpacity={0.8}>
          <LinearGradient colors={[USER_A, USER_B]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={SB.newChatGrad}>
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={SB.newChatText}>New Chat</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={SB.sectionLabel}>Recent History</Text>
        {historyLoading ? (
          <View style={SB.loaderRow}>
            <ActivityIndicator color={PRIMARY} size="small" />
            <Text style={SB.loaderText}>Loading…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <Text style={SB.emptyText}>No conversations yet</Text>
        ) : (
          <FlatList
            windowSize={5}
            maxToRenderPerBatch={10}
            removeClippedSubviews
            data={sessions}
            keyExtractor={s => s.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => {
              const isScan  = item.isScanSession;
              const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return (
                <TouchableOpacity style={SB.sessionRow} onPress={() => { onSessionPress(item); onClose(); }} activeOpacity={0.75}>
                  <View style={[SB.sessionIcon, { backgroundColor: isScan ? 'rgba(22,163,74,0.10)' : 'rgba(13,148,136,0.10)' }]}>
                    <Ionicons name={isScan ? 'scan-outline' : 'chatbubble-ellipses-outline'} size={16} color={isScan ? PRIMARY : ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={SB.sessionTitle} numberOfLines={1}>{item.title || 'AI Chat'}</Text>
                    <Text style={SB.sessionMeta}>{dateStr} · {item._count?.messages || item.messages?.length || 0} msgs</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AIChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const farmCtx      = useFarm();
  const getAIContext = farmCtx?.getAIContext || (() => ({}));
  const { farms, activeFarm, activeFarmId, switchActiveFarm, hasFarms } = useMultiFarm();
  const { language, t } = useLanguage();

  const initialMsg             = route?.params?.initialMessage;
  const existingConversationId = route?.params?.conversationId;

  // ── State ───────────────────────────────────────────────────────────────────
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(route?.params?.voiceMode || false);
  const [farmPickerOpen, setFarmPickerOpen] = useState(false);
  const [farmContextEnabled, setFarmContextEnabled] = useState(true);

  const [messages, setMessages]     = useState([{ id: '0', role: 'ai', text: t('aiChat.welcomeMsg') }]);
  const [input,    setInput]        = useState('');
  const [typing,   setTyping]       = useState(false);
  const [conversationId, setConvId] = useState(existingConversationId || null);
  const flatRef    = useRef(null);
  const lastSentAt = useRef(0);

  const [isRecording,  setIsRecording]  = useState(false);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordDuration, setRecDur]     = useState(0);
  const [audioLevel,   setAudioLevel]   = useState(0);
  const [voiceResult,  setVoiceResult]  = useState(null);
  const recordRef        = useRef(null);
  const recTimerRef      = useRef(null);
  const recordingLockRef = useRef(false); // synchronous guard — set BEFORE async createAsync

  const [sessions,       setSessions]  = useState([]);
  const [historyLoading, setHLoading]  = useState(false);
  const [historyLoaded,  setHLoaded]   = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // Collision-safe ID: base-36 timestamp + 7 random base-36 chars, never share float precision
  const addMessage = useCallback((msg) => {
    const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    setMessages(prev => [...prev, { id, ...msg }]);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg || typing) return;
    SoundEffects.send();
    const now = Date.now();
    if (now - lastSentAt.current < 6000) {
      addMessage({ role: 'ai', text: `Please wait ${Math.ceil((6000 - (now - lastSentAt.current)) / 1000)}s before sending another message.` });
      return;
    }
    lastSentAt.current = now;
    setInput('');
    addMessage({ role: 'user', text: msg });
    setTyping(true);
    try {
      const result = await sendChatMessage(msg, conversationId, farmContextEnabled ? getAIContext() : {}, farmContextEnabled, language);
      if (result.conversationId && !conversationId) setConvId(result.conversationId);
      const aiMsg = { role: 'ai', text: result.reply };
      if (result.type === 'diagnosis' && result.card) aiMsg.diagnosisData = result.card;
      if (result.type === 'market'    && result.card) aiMsg.marketData    = result.card;
      addMessage(aiMsg);
    } catch (err) {
      addMessage({ role: 'ai', text: `⚠ ${err.response?.status === 429 ? 'Too many requests — wait 30s.' : 'Could not reach FarmMind AI. Check your connection.'}` });
    } finally { setTyping(false); }
  }, [input, typing, conversationId, addMessage, getAIContext, farmContextEnabled, language]);

  const startRecording = useCallback(async () => {
    // Synchronous lock checked BEFORE any async work.
    // recordRef.current is only set after createAsync resolves, so two concurrent
    // calls would both pass a plain recordRef.current===null check and both reach
    // createAsync → "Only one Recording object can be prepared at a given time".
    // recordingLockRef flips to true instantly, blocking the second call.
    if (isProcessing || recordRef.current || recordingLockRef.current) return;
    recordingLockRef.current = true;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission', 'Please allow microphone access in Settings → Apps → CropSetu → Permissions.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:        true,
        playsInSilentModeIOS:      true,
        staysActiveInBackground:   false,
        shouldDuckAndroid:         true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension:        '.m4a',
          outputFormat:     Audio.AndroidOutputFormat?.MPEG_4 ?? 2,
          audioEncoder:     Audio.AndroidAudioEncoder?.AAC   ?? 3,
          sampleRate:       44100,
          numberOfChannels: 1,
          bitRate:          64000,
        },
        ios: {
          extension:           '.m4a',
          outputFormat:        Audio.IOSOutputFormat?.MPEG4AAC ?? 'aac ',
          audioQuality:        Audio.IOSAudioQuality?.MEDIUM   ?? 0x60,
          sampleRate:          44100,
          numberOfChannels:    1,
          bitRate:             64000,
          linearPCMBitDepth:   16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat:    false,
        },
        web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
      });
      let lastUpdate = 0;
      recording.setOnRecordingStatusUpdate((s) => {
        const now = Date.now();
        if (s.isRecording && s.metering !== undefined && now - lastUpdate > 90) {
          lastUpdate = now;
          setAudioLevel(Math.max(0, Math.min(1, (s.metering + 60) / 48)));
        }
      });
      recordRef.current = recording;
      setIsRecording(true); setVoiceResult(null); setRecDur(0); setAudioLevel(0);
      recTimerRef.current = setInterval(() => setRecDur(d => d + 1), 1000);
    } catch (err) {
      console.error('[Recording] startRecording failed:', err?.message || err);
      Alert.alert('Recording Error', `Could not start microphone.\n${err?.message || 'Please check microphone permissions and try again.'}`);
    } finally {
      // Always release the lock so a manual retry can succeed after an error
      recordingLockRef.current = false;
    }
  }, [isProcessing]);

  const stopAndSend = useCallback(async () => {
    if (!recordRef.current) return;
    clearInterval(recTimerRef.current);
    setIsRecording(false); setIsProcessing(true); setAudioLevel(0);
    try {
      await recordRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordRef.current.getURI();
      recordRef.current = null;
      if (!uri) { setIsProcessing(false); return; }
      const result = await sendVoiceMessage(uri, conversationId, getAIContext());
      if (result.conversationId && !conversationId) setConvId(result.conversationId);
      // Add both messages to chat immediately
      addMessage({ role: 'user', text: result.transcription || '(voice)', isVoice: true });
      const aiMsg = { role: 'ai', text: result.reply };
      if (result.type === 'diagnosis' && result.card) aiMsg.diagnosisData = result.card;
      if (result.type === 'market'    && result.card) aiMsg.marketData    = result.card;
      addMessage(aiMsg);
      // Set result — the useEffect below watches this and closes after 4s
      setVoiceResult(result);
    } catch (err) {
      recordRef.current = null;
      setVoiceResult({ error: err.response?.status === 429 ? 'Rate limit — wait 30s.' : 'Processing failed. Try again.' });
    } finally { setIsProcessing(false); setRecDur(0); }
  }, [conversationId, addMessage, getAIContext]);

  const cancelRecording = useCallback(async () => {
    clearInterval(recTimerRef.current);
    if (recordRef.current) {
      try { await recordRef.current.stopAndUnloadAsync(); await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch { }
      recordRef.current = null;
    }
    recordingLockRef.current = false;
    setIsRecording(false); setIsPaused(false); setIsProcessing(false); setRecDur(0); setAudioLevel(0);
  }, []);

  const togglePause = useCallback(async () => {
    if (!recordRef.current) return;
    try {
      if (isPaused) {
        await recordRef.current.resumeAsync();
        recTimerRef.current = setInterval(() => setRecDur(d => d + 1), 1000);
        setIsPaused(false);
      } else {
        await recordRef.current.pauseAsync();
        clearInterval(recTimerRef.current);
        setIsPaused(true);
      }
    } catch (err) {
      console.warn('[Recording] togglePause failed:', err?.message);
    }
  }, [isPaused]);

  const loadHistory = useCallback(async () => {
    if (historyLoading) return;
    setHLoading(true);
    try {
      const [convos, scans] = await Promise.allSettled([getConversations(), getScanSessions()]);
      const convoList = convos.status === 'fulfilled' ? (convos.value || []).map(c => ({ ...c, isScanSession: false })) : [];
      const scanList  = scans.status  === 'fulfilled' ? (scans.value  || []).map(s => ({ ...s, isScanSession: true  })) : [];
      setSessions([...convoList, ...scanList].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setHLoaded(true);
    } finally { setHLoading(false); }
  }, [historyLoading]);

  // Auto-start recording as soon as the voice modal slides in.
  // We use a ref flag so double-mount (strict mode / fast-refresh) can't fire
  // two createAsync calls even when both see !isRecording.
  const autoStartFiredRef = useRef(false);
  useEffect(() => {
    if (!voiceVisible) { autoStartFiredRef.current = false; return; }
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    const t = setTimeout(() => startRecording(), 350);
    return () => clearTimeout(t);
  }, [voiceVisible, startRecording]);

  // Auto-redirect to chat after successful transcription (4 seconds)
  // Using useEffect instead of setTimeout inside async — reliable, React-idiomatic
  useEffect(() => {
    if (!voiceResult || voiceResult.error) return;
    const t = setTimeout(() => {
      setVoiceResult(null);
      setVoiceVisible(false);
    }, 4000);
    return () => clearTimeout(t); // cancelled if user closes manually or error occurs
  }, [voiceResult]);

  useEffect(() => { if (sidebarOpen && !historyLoaded) loadHistory(); }, [sidebarOpen]);

  useEffect(() => {
    if (existingConversationId) {
      getConversationMessages(existingConversationId)
        .then(convo => {
          if (convo?.messages?.length) {
            setMessages(convo.messages.map(m => ({
              id: m.id, role: m.role === 'assistant' ? 'ai' : 'user', text: m.content,
              diagnosisData: m.messageType === 'diagnosis' ? m.structuredData : null,
              marketData:    m.messageType === 'market'    ? m.structuredData : null,
            })));
          }
        }).catch(() => {});
    }
  }, []);

  useEffect(() => { if (initialMsg) setTimeout(() => sendMessage(initialMsg), 600); }, []);
  // Smart scroll: show user's question + start of AI reply together
  useEffect(() => {
    if (!flatRef.current || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'user' || typing) {
      // User just sent or AI is typing → scroll to bottom
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    } else if (lastMsg.role === 'ai') {
      // AI reply arrived → scroll to the user's message (before AI reply)
      // so user sees their question at top + AI answer flowing below
      const userMsgIndex = Math.max(0, messages.length - 2);
      setTimeout(() => {
        try {
          flatRef.current?.scrollToIndex({ index: userMsgIndex, animated: true, viewPosition: 0 });
        } catch {
          flatRef.current?.scrollToEnd({ animated: true });
        }
      }, 120);
    }
  }, [messages, typing]);

  // ─────────────────────────────────────────────────────────────────────────
  // ── Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AnimatedScreen>
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header (ChatGPT-style) ── */}
      <View style={[S.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={S.headerBtn} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={24} color={TEXT} />
        </TouchableOpacity>
        <TouchableOpacity style={S.headerCenter} activeOpacity={0.7} onPress={() => {}}>
          <Text style={S.headerTitle}>{t('aiChat.farmMind')}</Text>
          <Ionicons name="chevron-down" size={14} color={MUTED} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setMessages([{ id: '0', role: 'ai', text: t('aiChat.welcomeMsg') }]);
          setConvId(null);
        }} style={S.headerBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={22} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* ── Farm Context Selector ── */}
      {hasFarms ? (
        <View style={S.farmBar}>
          <View style={S.farmBarRow}>
            <TouchableOpacity style={[S.farmBarInner, { flex: 1 }]} onPress={() => farmContextEnabled && setFarmPickerOpen(!farmPickerOpen)} activeOpacity={farmContextEnabled ? 0.7 : 1}>
              <Ionicons name="leaf" size={14} color={farmContextEnabled ? PRIMARY : MUTED} />
              <Text style={[S.farmBarName, !farmContextEnabled && { color: MUTED }]} numberOfLines={1}>
                {farmContextEnabled ? (activeFarm?.farmName || activeFarm?.farmAlias || 'Select Farm') : 'Farm context off'}
              </Text>
              {farmContextEnabled && (
                <>
                  <Text style={S.farmBarMeta} numberOfLines={1}>
                    {activeFarm ? `${activeFarm.landSizeAcres}ac · ${(activeFarm.soilType || '').replace('_', ' ')} · ${activeFarm.irrigationSystem}` : ''}
                  </Text>
                  <Ionicons name={farmPickerOpen ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.farmBarPill, { backgroundColor: farmContextEnabled ? '#E8F5E9' : '#F5F5F5' }]}
              onPress={() => { setFarmContextEnabled(v => !v); setFarmPickerOpen(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name={farmContextEnabled ? 'toggle' : 'toggle-outline'} size={16} color={farmContextEnabled ? PRIMARY : MUTED} style={{ marginRight: 4 }} />
              <Text style={[S.farmBarPillText, { color: farmContextEnabled ? PRIMARY : MUTED }]}>
                {farmContextEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Farm dropdown */}
          {farmPickerOpen && farmContextEnabled && (
            <View style={S.farmDropdown}>
              {farms.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[S.farmDropItem, f.id === activeFarmId && S.farmDropItemActive]}
                  onPress={() => { switchActiveFarm(f.id); setFarmPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[S.farmDropName, f.id === activeFarmId && { color: PRIMARY, fontWeight: '700' }]}>
                      {f.farmName || f.farmAlias}
                    </Text>
                    <Text style={S.farmDropMeta}>
                      {[f.village, f.district].filter(Boolean).join(', ')} · {f.landSizeAcres}ac · {(f.soilType || '').replace('_', ' ')}
                    </Text>
                  </View>
                  {f.id === activeFarmId && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[S.farmBar, { backgroundColor: '#FFF3E0' }]}
          onPress={() => navigation.navigate('FarmAddEdit')}
          activeOpacity={0.7}
        >
          <View style={S.farmBarInner}>
            <Ionicons name="add-circle-outline" size={14} color="#E65100" />
            <Text style={[S.farmBarName, { color: '#E65100' }]}>Add your farm for personalized AI advice</Text>
            <Ionicons name="chevron-forward" size={14} color="#E65100" />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Chat ── */}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={false}
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={S.msgList}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Fallback: wait for layout, then retry
            setTimeout(() => {
              try { flatRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 }); }
              catch { flatRef.current?.scrollToEnd({ animated: true }); }
            }, 200);
          }}
          renderItem={({ item }) => (
            <MessageBubble msg={item} onBuyMedicine={() => navigation.navigate('AgriStore')} />
          )}
          ListFooterComponent={typing ? (
            <View style={S.aiBubbleWrap}>
              <View style={S.aiAvatar}><Ionicons name="leaf" size={14} color={PRIMARY} /></View>
              <View style={S.typingWrap}><TypingDots /></View>
            </View>
          ) : null}
        />

        {/* Input bar — ChatGPT style */}
        <View style={[S.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={S.inputRow}>
            {/* Voice button */}
            <TouchableOpacity
              style={S.inputIconBtn}
              onPress={() => setVoiceVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="mic-outline" size={20} color={MUTED} />
            </TouchableOpacity>

            <TextInput
              style={S.textInput}
              placeholder="Message FarmMind"
              placeholderTextColor={MUTED}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => sendMessage()}
            />

            {/* Send button */}
            <TouchableOpacity
              style={[S.sendBtn, (!input.trim() || typing) && S.sendBtnOff]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || typing}
              activeOpacity={0.8}
            >
              {typing ? (
                <ActivityIndicator size="small" color={MUTED} />
              ) : (
                <View style={[S.sendBtnInner, input.trim() && { backgroundColor: TEXT }]}>
                  <Ionicons name="arrow-up" size={16} color={input.trim() ? '#FFFFFF' : MUTED} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Voice modal (slides up, dark bg) ── */}
      <VoiceModal
        visible={voiceVisible}
        isRecording={isRecording}
        isPaused={isPaused}
        isProcessing={isProcessing}
        audioLevel={audioLevel}
        recordDuration={recordDuration}
        voiceResult={voiceResult}
        insets={insets}
        onStart={startRecording}
        onSend={stopAndSend}
        onCancel={cancelRecording}
        onPause={togglePause}
        onClose={() => {
          if (isRecording || isPaused) cancelRecording();
          setVoiceResult(null);
          setIsPaused(false);
          setVoiceVisible(false);
        }}
      />

      {/* ── Sidebar ── */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        historyLoading={historyLoading}
        insets={insets}
        onNewChat={() => {
          setMessages([{ id: '0', role: 'ai', text: t('aiChat.welcomeMsg') }]);
          setConvId(null);
        }}
        onSessionPress={(item) => navigation.push('AIChat', { conversationId: item.id })}
      />
    </View>
    </AnimatedScreen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Styles (light theme)
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Header — ChatGPT style: clean, centered title
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: TEXT },

  // Farm context bar
  farmBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  farmBarRow: { flexDirection: 'row', alignItems: 'center' },
  farmBarInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  farmBarName: { fontSize: 12, fontWeight: '600', color: TEXT2 },
  farmBarMeta: { flex: 1, fontSize: 10.5, color: MUTED, marginLeft: 2 },
  farmBarPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  farmBarPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  farmDropdown: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 10, paddingBottom: 6 },
  farmDropItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, marginTop: 4 },
  farmDropItemActive: { backgroundColor: '#F7F7F8' },
  farmDropName: { fontSize: 14, fontWeight: '500', color: TEXT },
  farmDropMeta: { fontSize: 11, color: MUTED, marginTop: 1 },

  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  // AI bubble — ChatGPT style: no border, no shadow, just text with avatar
  aiBubbleWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14, marginTop: 2,
    backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  aiBubble: { flex: 1, paddingTop: 2 },
  aiBubbleText: { fontSize: 15, color: TEXT, lineHeight: 24 },
  typingWrap: { paddingTop: 6 },

  // User bubble — ChatGPT style: dark rounded pill, right-aligned
  userBubbleWrap: { alignItems: 'flex-end', marginBottom: 20 },
  userBubble: {
    backgroundColor: '#F7F7F8', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, maxWidth: W * 0.82,
  },
  voiceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  voiceTagText: { fontSize: 9, color: MUTED, fontWeight: '600', letterSpacing: 0.5 },
  userBubbleText: { fontSize: 15, color: TEXT, lineHeight: 22 },

  dotsRow: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MUTED },

  // Input bar — ChatGPT style: clean rounded pill
  inputBar: { backgroundColor: COLORS.white, paddingHorizontal: 10, paddingTop: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 4,
    backgroundColor: '#F7F7F8', borderRadius: 24,
    paddingHorizontal: 6, paddingVertical: 6,
  },
  inputIconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, fontSize: 15, color: TEXT, maxHeight: 100, minHeight: 36, paddingVertical: 6, paddingHorizontal: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { opacity: 0.3 },
  sendBtnInner: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },

  diagCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: BORDER, maxWidth: W * 0.78, shadowColor: COLORS.black, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  diagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diagSevDot: { width: 8, height: 8, borderRadius: 4 },
  diagName: { fontSize: 15, fontWeight: '800', color: TEXT, flex: 1 },
  diagConf: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  diagConfText: { fontSize: 11, fontWeight: '700' },
  diagMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  diagMetaText: { fontSize: 11, color: MUTED },
  diagDivider: { height: 1, backgroundColor: BORDER },
  diagSectionLabel: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  diagStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  diagStepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  diagStepNumText: { fontSize: 10, color: PRIMARY, fontWeight: '800' },
  diagStepText: { fontSize: 12, color: TEXT2, lineHeight: 18, flex: 1 },
  diagTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: SURFACE, borderRadius: 8, padding: 10 },
  diagTipText: { fontSize: 11, color: TEXT2, lineHeight: 16, flex: 1 },
  buyBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 2 },
  buyBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  buyBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.white },

  mktCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: BORDER, maxWidth: W * 0.78 },
  mktCrop: { fontSize: 13, fontWeight: '800', color: COLORS.amber },
  mktRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mktMandi: { fontSize: 12, color: MUTED, flex: 1 },
  mktPrice: { fontSize: 13, fontWeight: '700', color: TEXT },
  mktTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: COLORS.yellowPale, borderRadius: 8, padding: 10, marginTop: 2 },
  mktTipText: { fontSize: 11, color: TEXT2, lineHeight: 16, flex: 1 },
});

// ── Voice modal styles ───────────────────────────────────────────────────────
// Sphere = full-screen, untouched. Controls = tiny strip at bottom.
const MIC_WRAP = 100;
const VM = StyleSheet.create({
  root: { position: 'absolute', inset: 0, backgroundColor: COLORS.black, zIndex: 100 },

  // Scrim — thin fade at the very bottom so controls are legible
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.30 },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 4,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: V_TEXT, letterSpacing: 0.3 },

  // Error card
  resultCard: {
    position: 'absolute', left: 24, right: 24,
    top: H * 0.55,
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { fontSize: 13, color: DANGER, textAlign: 'center' },
  retryBtn: { marginTop: 12, alignSelf: 'center' },
  retryText: { fontSize: 13, color: P_LIGHT, fontWeight: '700' },

  // Controls — ultra-compact strip at the very bottom
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', gap: 1,
    paddingHorizontal: 20,
  },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  processingText: { fontSize: 13, color: V_TEXT, fontWeight: '600' },

  listeningLabel: { fontSize: 10, fontWeight: '600', color: V_MUTED, letterSpacing: 1.5, textTransform: 'uppercase' },
  bigTimer: { fontSize: 24, fontWeight: '200', color: V_TEXT, letterSpacing: 4, marginBottom: 4 },

  // Three-button row — tight
  threeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, width: '100%' },
  sideBtnWrap: { alignItems: 'center', gap: 3 },
  sideBtnLabel: { fontSize: 9, color: V_MUTED, fontWeight: '500', letterSpacing: 0.4 },
  cancelCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  pauseCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Center mic button + rings — small
  micWrap: { width: MIC_WRAP, height: MIC_WRAP, alignItems: 'center', justifyContent: 'center' },
  ring3: {
    position: 'absolute',
    width: MIC_WRAP, height: MIC_WRAP, borderRadius: MIC_WRAP / 2,
    backgroundColor: P_LIGHT, top: 0, left: 0,
  },
  ring2: {
    position: 'absolute',
    width: MIC_WRAP * 0.73, height: MIC_WRAP * 0.73, borderRadius: MIC_WRAP * 0.365,
    backgroundColor: P_LIGHT,
    top: MIC_WRAP * 0.135, left: MIC_WRAP * 0.135,
  },
  ring1: {
    position: 'absolute',
    width: MIC_WRAP * 0.54, height: MIC_WRAP * 0.54, borderRadius: MIC_WRAP * 0.27,
    backgroundColor: P_LIGHT,
    top: MIC_WRAP * 0.23, left: MIC_WRAP * 0.23,
  },
  micBtn: {
    width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    shadowColor: P_LIGHT, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 18, elevation: 16,
  },
  micGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  doneHint: { fontSize: 9, color: V_MUTED, marginTop: 4, letterSpacing: 0.4 },

  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  successText: { fontSize: 14, color: V_TEXT, fontWeight: '600' },
});

// ── Sidebar styles (light) ─────────────────────────────────────────────────
const SB = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, width: W * 0.82, backgroundColor: BG, borderRightWidth: 1, borderRightColor: BORDER, paddingHorizontal: 16 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelAvatar: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  panelTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },

  newChatBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 24 },
  newChatGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16 },
  newChatText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  loaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loaderText: { fontSize: 13, color: TEXT2 },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center', paddingVertical: 24 },

  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SURFACE },
  sessionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 2 },
  sessionMeta: { fontSize: 11, color: MUTED },
});
