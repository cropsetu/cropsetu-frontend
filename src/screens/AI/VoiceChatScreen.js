/**
 * VoiceChatScreen — ChatGPT-style immersive voice conversation with FarmMind AI
 *
 * Full-screen holographic particle sphere as centerpiece.
 * Gradient-colored particles (green → teal → cyan → blue).
 * Minimal dark UI overlaid on top.
 *
 * Flow: User speaks → STT → AI reply → TTS → plays audio response
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import { sendVoiceChatMessage } from '../../services/aiApi';
import { useFarm } from '../../context/FarmContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS } from '../../constants/colors';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

const { width: W, height: H } = Dimensions.get('window');

// ── Gradient Particle Sphere (WebView Canvas) ───────────────────────────────
// Particles shift through green → teal → cyan → blue gradient
const SPHERE_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0A0A0A;overflow:hidden;height:100vh;width:100vw;}canvas{position:fixed;inset:0;width:100%;height:100%;}</style>
</head><body><canvas id="c"></canvas><script>
(function(){
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d'),W,H,CX,CY,dpr,t=0,rotY=0;
var state='idle',audioLevel=0;
var N=3500,px=new Float32Array(N),py=new Float32Array(N),pz=new Float32Array(N);
var vx=new Float32Array(N),vy=new Float32Array(N),vz=new Float32Array(N);
var tx=new Float32Array(N),ty=new Float32Array(N),tz=new Float32Array(N);
var hue=new Float32Array(N),phase=new Float32Array(N);
var PHI=Math.PI*(1+Math.sqrt(5)),FOV=500,CAM=520;

function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=window.innerWidth;H=window.innerHeight;CX=W/2;CY=H/2;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);initSphere();
}

function initSphere(){
  var R=Math.min(W,H)*0.30;
  for(var i=0;i<N;i++){
    var p=Math.acos(1-2*(i+0.5)/N),a=PHI*i;
    tx[i]=Math.sin(p)*Math.cos(a)*R;
    ty[i]=Math.sin(p)*Math.sin(a)*R;
    tz[i]=Math.cos(p)*R;
  }
}

function initParticles(){
  for(var i=0;i<N;i++){
    px[i]=(Math.random()-.5)*W*2;
    py[i]=(Math.random()-.5)*H*2;
    pz[i]=(Math.random()-.5)*800;
    vx[i]=vy[i]=vz[i]=0;
    // Gradient hues: 140(green) → 170(teal) → 190(cyan) → 220(blue)
    hue[i]=140+(i/N)*80;
    phase[i]=Math.random()*Math.PI*2;
  }
}

function update(){
  t+=0.003;
  var isActive=state!=='idle';
  var isRec=state==='recording';
  var isPlay=state==='playing';
  var isProc=state==='processing';

  // Rotation speed based on state
  rotY+=isRec?0.015+audioLevel*0.02:isPlay?0.012:isProc?0.008:0.004;

  // Jitter and breathe based on state
  var jitter=isRec?2.5+audioLevel*10:isPlay?3+audioLevel*5:isProc?2:1.2;
  var breathAmp=isRec?0.15+audioLevel*0.15:isPlay?0.1:isProc?0.08:0.03;
  var breathSpd=isRec?4:isPlay?3:2;
  var breathe=Math.sin(t*breathSpd)*breathAmp;

  for(var i=0;i<N;i++){
    var bx=tx[i]*(1+breathe),by=ty[i]*(1+breathe),bz=tz[i]*(1+breathe);
    var cY=Math.cos(rotY),sY=Math.sin(rotY);
    var rx=bx*cY-bz*sY,ry=by,rz=bx*sY+bz*cY;

    // Add organic noise
    rx+=Math.sin(t*8+phase[i])*jitter;
    ry+=Math.cos(t*9+phase[i])*jitter;
    rz+=Math.sin(t*7+phase[i]*2)*jitter;

    // Recording: particles explode outward with audio
    if(isRec&&audioLevel>0.2){
      var f=(audioLevel-0.2)*8;
      var norm=Math.sqrt(tx[i]*tx[i]+ty[i]*ty[i]+tz[i]*tz[i])||1;
      rx+=tx[i]/norm*f*Math.sin(phase[i]*3);
      ry+=ty[i]/norm*f*Math.cos(phase[i]*5);
      rz+=tz[i]/norm*f*Math.sin(phase[i]*7);
    }

    // Playing: wave ripple effect
    if(isPlay){
      var ang=Math.atan2(ty[i],tx[i]);
      ry+=Math.sin(ang*3+t*6)*3*(1+audioLevel*3);
    }

    // Processing: particles orbit slightly
    if(isProc){
      var orb=Math.sin(t*2+phase[i]*4)*4;
      rx+=orb;ry+=Math.cos(t*2.5+phase[i]*3)*3;
    }

    vx[i]+=(rx-px[i])*0.025;vy[i]+=(ry-py[i])*0.025;vz[i]+=(rz-pz[i])*0.025;
    vx[i]*=0.84;vy[i]*=0.84;vz[i]*=0.84;
    px[i]+=vx[i];py[i]+=vy[i];pz[i]+=vz[i];
  }
}

function draw(){
  ctx.fillStyle='rgba(10,10,10,0.18)';ctx.fillRect(0,0,W,H);
  var isActive=state!=='idle';

  for(var i=0;i<N;i++){
    var z=pz[i]+CAM;if(z<10)continue;
    var sc=FOV/z,sx=px[i]*sc+CX,sy=py[i]*sc+CY;
    var spd=Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]+vz[i]*vz[i]);
    var a=Math.min(1,(0.18+spd*0.07)*(sc*0.55));
    var sz=(0.4+spd*0.12)*sc;

    // Gradient hue shifts over time — creates flowing color effect
    var h=(hue[i]+t*25+Math.sin(phase[i]+t)*15)%360;
    var s=isActive?78+audioLevel*15:70;
    var l=isActive?52+audioLevel*20+spd*3:48+spd*2;

    if(isActive){
      a=Math.min(1,a*(1.15+audioLevel*0.5));
      sz*=(1+audioLevel*0.35);
    }

    ctx.beginPath();ctx.arc(sx,sy,sz,0,6.2832);
    ctx.fillStyle='hsla('+h+','+s+'%,'+l+'%,'+a+')';ctx.fill();
  }

  // Inner glow
  if(isActive){
    var gr=60+audioLevel*50;
    var grd=ctx.createRadialGradient(CX,CY,0,CX,CY,gr);
    grd.addColorStop(0,'rgba(22,163,74,'+(0.04+audioLevel*0.08)+')');
    grd.addColorStop(0.5,'rgba(13,148,136,'+(0.02+audioLevel*0.04)+')');
    grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();ctx.arc(CX,CY,gr,0,6.2832);ctx.fillStyle=grd;ctx.fill();
  }
}

function loop(){update();draw();requestAnimationFrame(loop);}

function onMsg(e){
  try{
    var d=JSON.parse(typeof e==='string'?e:(e.data||''));
    if(d.type==='state')state=d.value;
    if(d.type==='audioLevel')audioLevel=d.value;
  }catch(err){}
}
document.addEventListener('message',onMsg);window.addEventListener('message',onMsg);
resize();initParticles();loop();
window.addEventListener('resize',function(){ctx.resetTransform();resize();});
})();
</script></body></html>`;

// ── Sphere component ────────────────────────────────────────────────────────
function HolographicSphere({ state, audioLevel }) {
  const wvRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    wvRef.current?.postMessage(JSON.stringify({ type: 'state', value: state }));
  }, [state]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    wvRef.current?.postMessage(JSON.stringify({ type: 'audioLevel', value: audioLevel }));
  }, [audioLevel]);

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={wvRef}
        source={{ html: SPHERE_HTML }}
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

// Map app language codes to Sarvam BCP-47
const LANG_MAP = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN',
  kn: 'kn-IN', gu: 'gu-IN', pa: 'pa-IN', bn: 'bn-IN', ml: 'ml-IN',
};
const LANG_NAMES = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu',
  kn: 'Kannada', gu: 'Gujarati', pa: 'Punjabi', bn: 'Bengali', ml: 'Malayalam',
};

// ── Main screen ─────────────────────────────────────────────────────────────
export default function VoiceChatScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const farmCtx = useFarm();
  const getAIContext = farmCtx?.getAIContext || (() => ({}));
  const { language, t } = useLanguage();
  const sarvamLang = LANG_MAP[language] || 'hi-IN';
  const langName = LANG_NAMES[language] || 'Hindi';

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordDuration, setRecDur] = useState(0);
  const [conversationId, setConvId] = useState(null);

  // Transcript state — shows what user said & AI reply as floating text
  const [userTranscript, setUserTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  const recordRef = useRef(null);
  const recTimerRef = useRef(null);
  const lockRef = useRef(false);
  const soundRef = useRef(null);

  // Animations
  const transcriptFade = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(1)).current;

  // Sphere state
  const sphereState = isRecording ? 'recording'
    : isProcessing ? 'processing'
    : isPlaying ? 'playing'
    : 'idle';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordRef.current) {
        try { recordRef.current.stopAndUnloadAsync(); } catch {}
      }
      if (soundRef.current) {
        try { soundRef.current.unloadAsync(); } catch {}
      }
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  // Transcript animation
  useEffect(() => {
    Animated.timing(transcriptFade, {
      toValue: showTranscript ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showTranscript]);

  // ── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isProcessing || isPlaying || lockRef.current) return;
    lockRef.current = true;

    // Clear previous transcripts
    setUserTranscript('');
    setAiReply('');
    setShowTranscript(false);

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('aiChat.micPermTitle'), t('aiChat.micPermMsg'));
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true,
        staysActiveInBackground: false, shouldDuckAndroid: true,
      });
      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', outputFormat: 'aac ', audioQuality: 0x60, sampleRate: 44100, numberOfChannels: 1, bitRate: 64000 },
        web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
      });
      recordRef.current = recording;
      setIsRecording(true);
      setRecDur(0);

      // Mic press animation
      Animated.spring(micScale, { toValue: 0.9, useNativeDriver: true, speed: 50 }).start();

      recTimerRef.current = setInterval(() => {
        setRecDur(d => d + 1);
        recording.getStatusAsync().then(st => {
          if (st.isRecording && st.metering != null) {
            setAudioLevel(Math.max(0, Math.min(1, (st.metering + 50) / 50)));
          }
        }).catch(() => {});
      }, 200);
    } catch (err) {
      Alert.alert(t('aiChat.recErrorTitle'), err.message);
    } finally {
      lockRef.current = false;
    }
  }, [isProcessing, isPlaying]);

  // ── Stop and send ─────────────────────────────────────────────────────────
  const stopAndSend = useCallback(async () => {
    if (!recordRef.current) return;
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    setAudioLevel(0);
    setIsProcessing(true);
    Animated.spring(micScale, { toValue: 1, useNativeDriver: true, friction: 4 }).start();

    try {
      await recordRef.current.stopAndUnloadAsync();
      const uri = recordRef.current.getURI();
      recordRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const result = await sendVoiceChatMessage(uri, sarvamLang, conversationId, getAIContext());

      if (result.conversationId && !conversationId) setConvId(result.conversationId);

      // Show transcripts
      if (result.transcription) setUserTranscript(result.transcription);
      if (result.reply) setAiReply(result.reply);
      setShowTranscript(true);

      // Play audio response
      if (result.audio?.audio) {
        setIsProcessing(false);
        await playBase64Audio(result.audio.audio, result.audio.mimeType || 'audio/wav');
      } else {
        setIsProcessing(false);
      }
    } catch (err) {
      setAiReply(`Could not process. ${err.message || 'Try again.'}`);
      setShowTranscript(true);
      setIsProcessing(false);
    }
  }, [conversationId, sarvamLang, getAIContext]);

  // ── Cancel recording ────────────────────────────────────────────────────────
  const cancelRecording = useCallback(async () => {
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    setAudioLevel(0);
    Animated.spring(micScale, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
    if (recordRef.current) {
      try { await recordRef.current.stopAndUnloadAsync(); } catch {}
      recordRef.current = null;
    }
  }, []);

  // ── Play base64 audio ───────────────────────────────────────────────────────
  async function playBase64Audio(base64, mimeType) {
    try {
      setIsPlaying(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true,
      });
      const uri = `data:${mimeType};base64,${base64}`;
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      setIsPlaying(false);
    }
  }

  const mins = Math.floor(recordDuration / 60).toString().padStart(2, '0');
  const secs = (recordDuration % 60).toString().padStart(2, '0');

  // Status text
  const statusText = isRecording ? 'Listening...'
    : isProcessing ? 'Thinking...'
    : isPlaying ? 'Speaking...'
    : showTranscript ? 'Tap mic to ask again'
    : `Tap to speak in ${langName}`;

  return (
    <AnimatedScreen>
      <View style={S.root}>
        <StatusBar barStyle="light-content" />

        {/* ── Holographic sphere background ── */}
        <HolographicSphere state={sphereState} audioLevel={audioLevel} />

        {/* ── Gradient overlay for readability ── */}
        <LinearGradient
          colors={['rgba(10,10,10,0.6)', 'transparent', 'transparent', 'rgba(10,10,10,0.7)']}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Header ── */}
        <View style={[S.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          <View style={S.headerCenter}>
            <Text style={S.headerTitle}>{t('aiChat.farmMind')}</Text>
            <View style={S.langPill}>
              <View style={[S.langDot, {
                backgroundColor: isRecording ? '#EF4444' : isPlaying ? '#22C55E' : isProcessing ? '#0D9488' : '#86EFAC',
              }]} />
              <Text style={S.langPillTxt}>{langName}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.replace('AIChat')}
            style={S.headerBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* ── Center area — transcript overlay ── */}
        <View style={S.centerArea}>
          {/* Idle state prompt */}
          {!isRecording && !isProcessing && !isPlaying && !showTranscript && (
            <View style={S.idlePrompt}>
              <Text style={S.idleTitle}>{t('aiChat.talkToFarmMind')}</Text>
              <Text style={S.idleSub}>
                Ask about crops, diseases, mandi prices,{'\n'}schemes, weather — in {langName}
              </Text>
            </View>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <View style={S.recIndicator}>
              <View style={S.recDot} />
              <Text style={S.recText}>{mins}:{secs}</Text>
            </View>
          )}

          {/* Processing */}
          {isProcessing && (
            <View style={S.procWrap}>
              <Text style={S.procDots}>...</Text>
            </View>
          )}

          {/* Transcript — user said + AI reply */}
          <Animated.View style={[S.transcriptWrap, { opacity: transcriptFade }]} pointerEvents={showTranscript ? 'auto' : 'none'}>
            {userTranscript ? (
              <View style={S.tUserRow}>
                <Ionicons name="mic" size={12} color="rgba(134,239,172,0.7)" />
                <Text style={S.tUserTxt} numberOfLines={2}>{userTranscript}</Text>
              </View>
            ) : null}
            {aiReply ? (
              <Text style={S.tAiTxt} numberOfLines={6}>{aiReply}</Text>
            ) : null}
          </Animated.View>
        </View>

        {/* ── Bottom controls ── */}
        <View style={[S.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
          {/* Status */}
          <Text style={S.statusText}>{statusText}</Text>

          {/* Controls row */}
          <View style={S.controlsRow}>
            {isRecording ? (
              <>
                {/* Cancel */}
                <TouchableOpacity style={S.cancelBtn} onPress={cancelRecording} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color="#EF4444" />
                  <Text style={S.cancelTxt}>{t('cancel')}</Text>
                </TouchableOpacity>

                {/* Send button */}
                <Animated.View style={{ transform: [{ scale: micScale }] }}>
                  <TouchableOpacity style={S.sendBtn} onPress={stopAndSend} activeOpacity={0.85}>
                    <LinearGradient colors={['#22C55E', '#0D9488']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.sendGrad}>
                      <Ionicons name="arrow-up" size={26} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Spacer */}
                <View style={{ width: 56 }} />
              </>
            ) : (
              <>
                {/* New conversation */}
                <TouchableOpacity
                  style={S.auxBtn}
                  onPress={() => { setUserTranscript(''); setAiReply(''); setShowTranscript(false); setConvId(null); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color="rgba(255,255,255,0.6)" />
                  <Text style={S.auxTxt}>{t('aiChat.newChat')}</Text>
                </TouchableOpacity>

                {/* Mic button */}
                <Animated.View style={{ transform: [{ scale: micScale }] }}>
                  <TouchableOpacity
                    style={[S.micBtn, (isProcessing || isPlaying) && { opacity: 0.35 }]}
                    onPress={startRecording}
                    disabled={isProcessing || isPlaying}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={['#22C55E', '#0D9488']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.micGrad}>
                      <Ionicons name="mic" size={30} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Text mode */}
                <TouchableOpacity
                  style={S.auxBtn}
                  onPress={() => navigation.replace('AIChat')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="keypad-outline" size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={S.auxTxt}>{t('aiChat.textMode')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </AnimatedScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },

  // Header — minimal glass
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, zIndex: 10,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  langDot: { width: 6, height: 6, borderRadius: 3 },
  langPillTxt: { fontSize: 11, fontWeight: '600', color: '#86EFAC', letterSpacing: 0.3 },

  // Center area
  centerArea: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 28, paddingBottom: 20,
  },

  // Idle prompt
  idlePrompt: { alignItems: 'center', marginBottom: 40 },
  idleTitle: { fontSize: 24, fontWeight: '300', color: 'rgba(255,255,255,0.85)', marginBottom: 8, letterSpacing: 0.5 },
  idleSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 21 },

  // Recording indicator
  recIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 30,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recText: { fontSize: 16, fontWeight: '300', color: '#FCA5A5', letterSpacing: 2 },

  // Processing
  procWrap: { marginBottom: 30 },
  procDots: { fontSize: 32, color: 'rgba(134,239,172,0.5)', letterSpacing: 8, fontWeight: '300' },

  // Transcript overlay
  transcriptWrap: {
    width: '100%', maxHeight: H * 0.35,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  tUserRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  tUserTxt: { fontSize: 13, color: 'rgba(134,239,172,0.7)', fontWeight: '500', flex: 1, lineHeight: 19 },
  tAiTxt: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 23, fontWeight: '400' },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 8, alignItems: 'center',
    zIndex: 10,
  },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginBottom: 16, letterSpacing: 0.3 },

  // Controls row
  controlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 32, width: '100%',
  },

  // Mic button (idle)
  micBtn: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
    shadowColor: '#22C55E', shadowOpacity: 0.35, shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  micGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Send button (recording)
  sendBtn: {
    width: 68, height: 68, borderRadius: 34, overflow: 'hidden',
    shadowColor: '#22C55E', shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
  },
  sendGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Cancel button
  cancelBtn: {
    alignItems: 'center', gap: 4, width: 56,
  },
  cancelTxt: { fontSize: 10, color: 'rgba(239,68,68,0.7)', fontWeight: '600' },

  // Aux buttons (new, text)
  auxBtn: { alignItems: 'center', gap: 4, width: 56 },
  auxTxt: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
});
