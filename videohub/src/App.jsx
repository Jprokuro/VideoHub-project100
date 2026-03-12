import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { ref, onValue, set, update, remove, increment } from "firebase/database";
import {
  Play, Pause, Heart, Eye, Search, Plus, LogOut, User, Shield,
  Home, TrendingUp, Lock, ChevronRight, CheckCircle, Video,
  Youtube, Globe, HardDrive, Tv, Film, AlertTriangle, X,
  Sparkles, Crown, Clock, MoreVertical, Share2, Trash2,
  ExternalLink, Volume2, VolumeX, Maximize2, RotateCcw,
  Flag, Bookmark, Github, Zap, RefreshCw, Users
} from "lucide-react";

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const USER_KEY  = "vh_user";
const LIKE_KEY  = "vh_likes";
const ADMIN     = atob("SnBybzk1");            // "Jpro95" obfuscated
/* ══════════════════════════════════════════════════════════════
   SUPPORTED VIDEO EXTENSIONS — direct file formats
══════════════════════════════════════════════════════════════ */
const VEXT = /\.(mp4|webm|mov|ogg|ogv|m4v|avi|flv|mkv|3gp|3g2|ts|m2ts|mts|wmv|asf|rm|rmvb|f4v|f4p|divx|xvid|h264|h265|hevc|vp8|vp9|av1|mpg|mpeg|m2v|m4p|mp2|mpe|mpv|qt|svi|mxf|roq|nsv|amv|m2p|vob|dv|drc|gifv|mng|yuv|y4m|dav)(\?.*)?$/i;

/* ══════════════════════════════════════════════════════════════
   detectType — matches 20+ platforms + direct video
══════════════════════════════════════════════════════════════ */
const detectType = url => {
  const u = url.toLowerCase().trim();
  // ── Video Platforms ──
  if (u.includes("youtube.com") || u.includes("youtu.be"))            return "youtube";
  if (u.includes("drive.google.com"))                                  return "gdrive";
  if (u.includes("vimeo.com"))                                         return "vimeo";
  if (u.includes("dailymotion.com") || u.includes("dai.ly"))          return "dailymotion";
  if (u.includes("facebook.com") || u.includes("fb.watch") || u.includes("fb.com/watch")) return "facebook";
  if (u.includes("instagram.com"))                                     return "instagram";
  if (u.includes("tiktok.com"))                                        return "tiktok";
  if (u.includes("twitch.tv"))                                         return "twitch";
  if (u.includes("rumble.com"))                                        return "rumble";
  if (u.includes("odysee.com") || u.includes("lbry.tv"))              return "odysee";
  if (u.includes("bilibili.com") || u.includes("b23.tv"))             return "bilibili";
  if (u.includes("streamable.com"))                                    return "streamable";
  if (u.includes("loom.com"))                                          return "loom";
  if (u.includes("wistia.com") || u.includes("wi.st"))                return "wistia";
  if (u.includes("archive.org"))                                       return "archive";
  if (u.includes("dropbox.com"))                                       return "dropbox";
  if (u.includes("onedrive.live.com") || u.includes("1drv.ms") || u.includes("sharepoint.com")) return "onedrive";
  if (u.includes("streamff.com") || u.includes("stream.ff"))          return "streamff";
  if (u.includes("iframe.mediadelivery.net") || u.includes("bunny.net")) return "bunny";
  if (u.includes("cloudflarestream.com") || u.includes("videodelivery.net")) return "cfstream";
  if (u.includes("ok.ru") || u.includes("odnoklassniki.ru"))          return "okru";
  if (u.includes("rutube.ru"))                                         return "rutube";
  if (u.includes("peertube") || u.includes("/videos/embed/"))         return "peertube";
  // ── Direct file extensions ──
  if (VEXT.test(u)) return "direct";
  // ── Dropbox / OneDrive direct links ──
  if (u.includes("dl.dropboxusercontent.com"))                         return "direct";
  if (u.includes("1drv.ms") || u.includes("d.docs.live.net"))         return "direct";
  return "embed"; // unknown → try iframe
};

/* ══════════════════════════════════════════════════════════════
   getEmbed — produces embeddable iframe URL for each platform
══════════════════════════════════════════════════════════════ */
const getEmbed = (url, type) => {
  const u = url.trim();
  const enc2 = s => encodeURIComponent(s);

  switch (type) {
    case "youtube": {
      let id = "";
      if (u.includes("youtu.be/"))      id = u.split("youtu.be/")[1]?.split("?")[0] || "";
      else if (u.includes("/shorts/"))  id = u.split("/shorts/")[1]?.split("?")[0] || "";
      else if (u.includes("/live/"))    id = u.split("/live/")[1]?.split("?")[0] || "";
      else { const m = u.match(/[?&]v=([^&]+)/); id = m?.[1] || ""; }
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    }
    case "gdrive": {
      const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
      return `https://drive.google.com/file/d/${m?.[1] || ""}/preview`;
    }
    case "vimeo": {
      const m = u.match(/vimeo\.com\/(\d+)/);
      return `https://player.vimeo.com/video/${m?.[1] || ""}?autoplay=1&dnt=1`;
    }
    case "dailymotion": {
      const m = u.match(/video\/([a-zA-Z0-9]+)/);
      return `https://www.dailymotion.com/embed/video/${m?.[1] || ""}?autoplay=1`;
    }
    case "facebook": {
      return `https://www.facebook.com/plugins/video.php?href=${enc2(u)}&show_text=false&autoplay=true&mute=false`;
    }
    case "instagram": {
      // /p/{code} or /reel/{code}
      const m = u.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
      return m ? `https://www.instagram.com/p/${m[1]}/embed/` : u;
    }
    case "tiktok": {
      const m = u.match(/video\/(\d+)/);
      return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : u;
    }
    case "twitch": {
      const parent = encodeURIComponent(window.location.hostname || "localhost");
      if (u.includes("/clip/")) {
        const m = u.match(/clip\/([A-Za-z0-9_-]+)/);
        return `https://clips.twitch.tv/embed?clip=${m?.[1]}&parent=${parent}&autoplay=true`;
      }
      if (u.includes("/videos/")) {
        const m = u.match(/videos\/(\d+)/);
        return `https://player.twitch.tv/?video=v${m?.[1]}&parent=${parent}&autoplay=true`;
      }
      const chan = u.split("twitch.tv/")[1]?.split("?")[0] || "";
      return `https://player.twitch.tv/?channel=${chan}&parent=${parent}&autoplay=true`;
    }
    case "rumble": {
      const m = u.match(/rumble\.com\/embed\/([a-zA-Z0-9]+)/);
      if (m) return `https://rumble.com/embed/${m[1]}/?pub=4`;
      const m2 = u.match(/rumble\.com\/v([a-zA-Z0-9]+)/);
      if (m2) return `https://rumble.com/embed/v${m2[1]}/?pub=4`;
      return u;
    }
    case "odysee": {
      // https://odysee.com/@channel/title → embed
      const m = u.match(/odysee\.com\/([^?]+)/);
      if (m) return `https://odysee.com/$/embed/${m[1]}?autoplay=true`;
      return u;
    }
    case "bilibili": {
      const bv = u.match(/[Bb][Vv]([a-zA-Z0-9]+)/)?.[1];
      const av = u.match(/av(\d+)/i)?.[1];
      if (bv) return `https://player.bilibili.com/player.html?bvid=BV${bv}&autoplay=1&high_quality=1`;
      if (av) return `https://player.bilibili.com/player.html?aid=${av}&autoplay=1&high_quality=1`;
      return u;
    }
    case "streamable": {
      const m = u.match(/streamable\.com\/([a-zA-Z0-9]+)/);
      return m ? `https://streamable.com/e/${m[1]}?autoplay=1` : u;
    }
    case "loom": {
      const m = u.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
      return m ? `https://www.loom.com/embed/${m[1]}?autoplay=1` : u;
    }
    case "wistia": {
      const m = u.match(/(?:wistia\.com\/medias\/|wi\.st\/)([a-zA-Z0-9]+)/);
      return m ? `https://fast.wistia.net/embed/iframe/${m[1]}?autoPlay=true` : u;
    }
    case "archive": {
      const m = u.match(/archive\.org\/details\/([^/?]+)/);
      return m ? `https://archive.org/embed/${m[1]}` : u;
    }
    case "dropbox": {
      return u.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "").replace("?dl=1", "");
    }
    case "onedrive": {
      if (u.includes("1drv.ms") || u.includes("onedrive.live.com")) {
        return `https://onedrive.live.com/embed?resid=${enc2(u)}&em=2&wdAr=1.7777777777777777`;
      }
      return u;
    }
    case "bunny": {
      // Bunny.net stream / mediadelivery embed
      if (u.includes("iframe.mediadelivery.net")) return u;
      const m = u.match(/mediadelivery\.net\/embed\/([^/]+)\/([^/?]+)/);
      return m ? `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?autoplay=true` : u;
    }
    case "cfstream": {
      const m = u.match(/(?:videodelivery\.net|cloudflarestream\.com)\/([a-zA-Z0-9]+)/);
      return m ? `https://iframe.videodelivery.net/${m[1]}?autoplay=true` : u;
    }
    case "okru": {
      const m = u.match(/\/video\/(\d+)/);
      return m ? `https://ok.ru/videoembed/${m[1]}?autoplay=1` : u;
    }
    case "rutube": {
      const m = u.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/);
      return m ? `https://rutube.ru/play/embed/${m[1]}/` : u;
    }
    case "peertube": {
      if (u.includes("/videos/embed/")) return u;
      const m = u.match(/\/videos\/watch\/([a-zA-Z0-9-]+)/);
      if (m) return u.replace("/videos/watch/", "/videos/embed/") + "?autoplay=1&warningTitle=0";
      return u;
    }
    default:
      return u;
  }
};

/* ══════════════════════════════════════════════════════════════
   TYPE META — badge color, icon name, label for each platform
══════════════════════════════════════════════════════════════ */
const TYPE_META = {
  youtube:    { label:"YouTube",    bg:"#FEF2F2", color:"#DC2626" },
  gdrive:     { label:"Drive",      bg:"#EFF6FF", color:"#2563EB" },
  vimeo:      { label:"Vimeo",      bg:"#F0FDF4", color:"#16A34A" },
  dailymotion:{ label:"DMotion",    bg:"#FFF7ED", color:"#EA580C" },
  facebook:   { label:"Facebook",   bg:"#EFF6FF", color:"#1D4ED8" },
  instagram:  { label:"Instagram",  bg:"#FDF2F8", color:"#BE185D" },
  tiktok:     { label:"TikTok",     bg:"#F0FDFA", color:"#0F766E" },
  twitch:     { label:"Twitch",     bg:"#F5F3FF", color:"#6D28D9" },
  rumble:     { label:"Rumble",     bg:"#FFF7ED", color:"#C2410C" },
  odysee:     { label:"Odysee",     bg:"#FFF1F2", color:"#BE123C" },
  bilibili:   { label:"Bilibili",   bg:"#FFF0F0", color:"#E11D48" },
  streamable: { label:"Streambl",   bg:"#F0FDFF", color:"#0E7490" },
  loom:       { label:"Loom",       bg:"#FFF7ED", color:"#B45309" },
  wistia:     { label:"Wistia",     bg:"#FEFCE8", color:"#A16207" },
  archive:    { label:"Archive",    bg:"#F8FAFC", color:"#475569" },
  dropbox:    { label:"Dropbox",    bg:"#EFF6FF", color:"#1E40AF" },
  onedrive:   { label:"OneDrive",   bg:"#EFF6FF", color:"#1D4ED8" },
  bunny:      { label:"Bunny",      bg:"#FFF1F2", color:"#E11D48" },
  cfstream:   { label:"CF Stream",  bg:"#FFF7ED", color:"#B45309" },
  okru:       { label:"OK.ru",      bg:"#FFF7ED", color:"#EA580C" },
  rutube:     { label:"RuTube",     bg:"#FEF2F2", color:"#DC2626" },
  peertube:   { label:"PeerTube",   bg:"#F0FDF4", color:"#15803D" },
  streamff:   { label:"StreamFF",   bg:"#F5F3FF", color:"#7C3AED" },
  direct:     { label:"Video",      bg:"#F5F3FF", color:"#7C3AED" },
  embed:      { label:"Embed",      bg:"#F8FAFC", color:"#64748B" },
};

/* get format extension for direct videos */
const getDirectExt = url => {
  const m = url.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/);
  return m ? m[1].toUpperCase() : "VIDEO";
};

/* ══════════════════════════════════════════
   SECURITY LAYER
══════════════════════════════════════════ */
const _sec = (() => {
  let _done = false;
  return () => {
    if (_done) return; _done = true;
    document.addEventListener("contextmenu", e => e.preventDefault(), true);
    document.addEventListener("keydown", e => {
      const bad = e.key === "F12"
        || (e.ctrlKey && e.shiftKey && ["I","J","C","U","K"].includes(e.key.toUpperCase()))
        || (e.ctrlKey && ["U","S"].includes(e.key.toUpperCase()));
      if (bad) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener("dragstart", e => {
      if (e.target.tagName === "VIDEO") e.preventDefault();
    });
    const s = document.createElement("style");
    s.textContent = `
      *{-webkit-user-select:none!important;user-select:none!important;}
      input,textarea{-webkit-user-select:text!important;user-select:text!important;}
      video::-webkit-media-controls,video::-webkit-media-controls-enclosure{display:none!important;}
      video{pointer-events:none!important;}
    `;
    document.head.appendChild(s);
  };
})();

/* ══════════════════════════════════════════
   URL OBFUSCATION — no raw URLs in storage
══════════════════════════════════════════ */
const enc = s => {
  try { return btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)))); }
  catch { return s; }
};
const dec = s => {
  try { return decodeURIComponent(Array.from(atob(s), c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")); }
  catch { return s; }
};

/* ══════════════════════════════════════════
   FIREBASE HELPERS
══════════════════════════════════════════ */
const fbSetVideo  = (v)   => set(ref(db, `videos/${v.id}`), { ...v, _x: enc(v.url), url: undefined });
const fbDelVideo  = (id)  => remove(ref(db, `videos/${id}`));
const fbIncrView  = (id)  => update(ref(db, `videos/${id}`), { views: increment(1) });
const fbSetUser   = (u)   => set(ref(db, `users/${u.name}`), u);
const fbDelUser   = (name)=> remove(ref(db, `users/${name}`));

const unpackVid = v => ({ ...v, url: v._x ? dec(v._x) : (v.url || "") });

/* ══════════════════════════════════════════
   THEME & HELPERS
══════════════════════════════════════════ */
const C = {
  bg:"#F7F5FF",
  card:"#FFFFFF",
  purple:"#9B7FE8",  purple2:"#8B5CF6",
  purpleL:"#F4F1FF", purpleM:"#E5DEFF",
  pink:"#E879A0",    pinkL:"#FEF0F6", pinkM:"#FBD0E8",
  text:"#2D2460",    sub:"#A0AABF",   border:"#EEE9FF",
  gold:"#F5A623",    goldL:"#FFFBF0", goldM:"#FDECC0",
  error:"#FC8181",   success:"#68D391",
  s1:"rgba(155,127,232,0.07)", s2:"rgba(155,127,232,0.14)",
};

const ago = ts => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const getYtThumb = url => {
  let id = "";
  if (url.includes("youtu.be/"))     id = url.split("youtu.be/")[1]?.split("?")[0] || "";
  else if (url.includes("/shorts/")) id = url.split("/shorts/")[1]?.split("?")[0] || "";
  else if (url.includes("/live/"))   id = url.split("/live/")[1]?.split("?")[0] || "";
  else { const m = url.match(/[?&]v=([^&]+)/); id = m?.[1] || ""; }
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
};

/* ══════════════════════════════════════════
   SEED VIDEOS
══════════════════════════════════════════ */
const SEEDS = [
  { id: "s1", title: "Big Buck Bunny", desc: "Classic open-source animated film.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    author: ADMIN, ts: Date.now() - 3600000 * 72, likes: 57, views: 389 },
  { id: "s2", title: "Elephants Dream", desc: "First Blender open movie project.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    author: ADMIN, ts: Date.now() - 3600000 * 24, likes: 31, views: 204 },
];

/* ══════════════════════════════════════════
   UI COMPONENTS
══════════════════════════════════════════ */

function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:300,
      background:"rgba(20,12,50,.28)",
      backdropFilter:"blur(16px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"100%", maxWidth:520,
        background:"rgba(255,255,255,.98)",
        backdropFilter:"blur(20px)",
        borderRadius:"36px 36px 0 0",
        padding:"10px 0 0",
        maxHeight:"93vh", overflowY:"auto",
        boxShadow:"0 -16px 60px rgba(155,127,232,.14), 0 -1px 0 rgba(155,127,232,.08)",
        animation:"sheetUp .32s cubic-bezier(.34,1.3,.64,1)",
      }}>
        <div style={{
          width:40, height:4, borderRadius:99,
          background:"linear-gradient(90deg,#E5DEFF,#FBD0E8)",
          margin:"0 auto 20px",
        }}/>
        <div style={{ padding:"0 20px 48px" }}>{children}</div>
      </div>
    </div>
  );
}

function TypeBadge({ url }) {
  const type = detectType(url);
  const meta = TYPE_META[type] || TYPE_META.embed;
  const label = type === "direct" ? getDirectExt(url) : meta.label;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      background:meta.bg, color:meta.color,
      fontSize:9, fontWeight:900, padding:"3px 9px",
      borderRadius:99, letterSpacing:.4,
      border:`1px solid ${meta.color}25`,
      flexShrink:0, whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

/* ══════════════════════════════════
   SOFT YOUTUBE PLAYER
══════════════════════════════════ */
function YoutubePlayer({ url }) {
  const [active, setActive] = useState(false);
  const [hov,    setHov]    = useState(false);
  const [imgOk,  setImgOk]  = useState(true);
  const thumb = getYtThumb(url);

  if (active) return (
    <div style={{ position:"relative", paddingBottom:"56.25%", background:"#0c0c14" }}>
      <iframe src={getEmbed(url,"youtube")}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen/>
    </div>
  );

  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={() => setActive(true)}
      style={{
        position:"relative", cursor:"pointer",
        overflow:"hidden", aspectRatio:"16/9", minHeight:190,
        background:"linear-gradient(160deg,#1a1030 0%,#0e0820 100%)",
        transition:"transform .35s cubic-bezier(.25,.46,.45,.94)",
        transform: hov ? "scale(1.008)" : "scale(1)",
      }}>

      {/* soft blurred bg wash */}
      {thumb && imgOk && (
        <img src={thumb} alt="" onError={()=>setImgOk(false)}
          style={{
            position:"absolute", inset:"-12%", width:"124%", height:"124%",
            objectFit:"cover", pointerEvents:"none",
            filter:"blur(32px) brightness(.22) saturate(1.6)",
          }}/>
      )}

      {/* main thumbnail — soft fade in */}
      {thumb && imgOk
        ? <img src={thumb} alt="" onError={()=>setImgOk(false)}
            style={{
              position:"absolute", inset:0, width:"100%", height:"100%",
              objectFit:"cover", display:"block",
              opacity: hov ? 0.92 : 0.72,
              transform: hov ? "scale(1.035)" : "scale(1)",
              transition:"transform .8s cubic-bezier(.25,.46,.45,.94), opacity .5s ease",
            }}/>
        : <div style={{
            position:"absolute", inset:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"linear-gradient(145deg,#1e1040,#0e0628)",
          }}>
            <Youtube size={48} color="rgba(255,255,255,.08)" strokeWidth={1}/>
          </div>
      }

      {/* soft vignette overlay */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"linear-gradient(180deg, rgba(10,5,25,.5) 0%, transparent 28%, transparent 55%, rgba(6,3,16,.75) 100%)",
        transition:"opacity .4s",
      }}/>

      {/* subtle purple tint on hover */}
      {hov && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,.07) 0%, transparent 100%)",
        }}/>
      )}

      {/* ── TOP PILL ── */}
      <div style={{
        position:"absolute", top:12, left:12, right:12,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        opacity: hov ? 1 : 0.8, transition:"opacity .35s",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:5,
          background:"rgba(220,38,38,.82)", backdropFilter:"blur(12px)",
          padding:"4px 10px 4px 8px", borderRadius:99,
          boxShadow:"0 2px 12px rgba(220,38,38,.3)",
        }}>
          <Youtube size={11} fill="white" color="white" strokeWidth={0}/>
          <span style={{ fontSize:9, fontWeight:900, color:"#fff", letterSpacing:.8 }}>YOUTUBE</span>
        </div>

        <a href={url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
          style={{
            display:"flex", alignItems:"center", gap:4,
            background:"rgba(255,255,255,.12)", backdropFilter:"blur(14px)",
            border:"1px solid rgba(255,255,255,.16)",
            color:"rgba(255,255,255,.85)", fontSize:9, fontWeight:700,
            padding:"4px 10px", borderRadius:99, textDecoration:"none",
            transition:"background .2s",
          }}>
          <ExternalLink size={9}/>খুলুন
        </a>
      </div>

      {/* ── SOFT CENTER PLAY ── */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        gap:14, pointerEvents:"none",
      }}>
        {/* soft glow halo */}
        <div style={{
          position:"absolute",
          width: hov ? 160 : 120, height: hov ? 160 : 120, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(139,92,246,.18) 0%, transparent 70%)",
          transition:"all .55s cubic-bezier(.25,.46,.45,.94)",
          animation: hov ? "softPulse 2s ease-in-out infinite" : "softPulse 3s ease-in-out infinite",
        }}/>

        {/* frosted glass play button */}
        <div style={{
          width: hov ? 68 : 60, height: hov ? 68 : 60, borderRadius:"50%",
          background: hov
            ? "linear-gradient(145deg, rgba(255,255,255,.28), rgba(255,255,255,.14))"
            : "linear-gradient(145deg, rgba(255,255,255,.18), rgba(255,255,255,.07))",
          backdropFilter:"blur(20px)",
          border:`1.5px solid ${hov ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.25)"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow: hov
            ? "0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.3)"
            : "0 4px 20px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.2)",
          transform: hov ? "scale(1.08)" : "scale(1)",
          transition:"all .4s cubic-bezier(.34,1.3,.64,1)",
        }}>
          <Play size={hov?27:23} fill="white" color="white" style={{ marginLeft: hov?4:3 }}/>
        </div>

        {/* label pill */}
        <div style={{
          background:"rgba(0,0,0,.38)", backdropFilter:"blur(16px)",
          border:"1px solid rgba(255,255,255,.1)",
          padding:"5px 14px", borderRadius:99,
          display:"flex", alignItems:"center", gap:6,
          opacity: hov ? 1 : 0.7, transition:"opacity .35s",
        }}>
          <div style={{
            width:5, height:5, borderRadius:"50%",
            background:"#ef4444",
            animation:"softBlink 2s ease-in-out infinite",
            boxShadow:"0 0 6px rgba(239,68,68,.7)",
          }}/>
          <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.85)" }}>
            ট্যাপ করে দেখুন
          </span>
        </div>
      </div>

      <style>{`
        @keyframes softPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes softBlink{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════
   ULTRA-PREMIUM CUSTOM VIDEO PLAYER
══════════════════════════════════════════ */
function CustomPlayer({ url }) {
  const wrapRef  = useRef(null);
  const vidRef   = useRef(null);
  const barRef   = useRef(null);
  const timerRef = useRef(null);
  const lastTap  = useRef(0);

  const [play,     setPlay]     = useState(false);
  const [err,      setErr]      = useState(false);
  const [buffering,setBuf]      = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [vol,      setVol]      = useState(1);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDur]      = useState(0);
  const [ctrl,     setCtrl]     = useState(true);
  const [speed,    setSpeed]    = useState(1);
  const [showSpd,  setShowSpd]  = useState(false);
  const [showVol,  setShowVol]  = useState(false);
  const [seeking,  setSeeking]  = useState(false);
  const [hPct,     setHPct]     = useState(null);
  const [flash,    setFlash]    = useState(null);
  const [isFs,     setIsFs]     = useState(false);
  const [ended,    setEnded]    = useState(false);
  const [barHov,   setBarHov]   = useState(false);
  const [ripples,  setRipples]  = useState([]);

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  const fmt = s => {
    if (!s || isNaN(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = String(Math.floor(s % 60)).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${sc}` : `${m}:${sc}`;
  };

  /* auto-hide controls */
  const showCtrl = useCallback(() => {
    setCtrl(true); clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCtrl(false); setShowSpd(false); setShowVol(false);
    }, 3200);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  /* fullscreen listener */
  useEffect(() => {
    const fn = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const doFlash = (side, label) => {
    setFlash({ side, label });
    setTimeout(() => setFlash(null), 650);
  };

  /* play / pause */
  const toggle = useCallback(() => {
    const v = vidRef.current; if (!v || err) return;
    if (play) {
      v.pause(); setPlay(false); setCtrl(true); clearTimeout(timerRef.current);
    } else {
      setBuf(true);
      v.play().then(() => { setPlay(true); setEnded(false); setBuf(false); showCtrl(); })
               .catch(() => { setErr(true); setBuf(false); });
    }
  }, [play, err, showCtrl]);

  /* tap / double-tap */
  const handleTap = e => {
    if (e.type === "touchend") e.preventDefault();
    const now = Date.now();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tx = e.changedTouches?.[0]?.clientX ?? e.clientX;
    const ty = e.changedTouches?.[0]?.clientY ?? e.clientY;
    const cx = tx - rect.left;
    const side = cx < rect.width * 0.38 ? "left" : cx > rect.width * 0.62 ? "right" : "center";

    // add ripple
    const rid = Date.now() + Math.random();
    setRipples(r => [...r, { id: rid, x: tx - rect.left, y: ty - rect.top }]);
    setTimeout(() => setRipples(r => r.filter(p => p.id !== rid)), 700);

    if (now - lastTap.current < 290) {
      lastTap.current = 0;
      if (side === "center") return;
      const v = vidRef.current; if (!v) return;
      const delta = side === "right" ? 10 : -10;
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
      doFlash(side, delta > 0 ? "+10s" : "−10s");
      showCtrl();
    } else {
      lastTap.current = now;
      setTimeout(() => { if (lastTap.current === now) toggle(); }, 295);
    }
  };

  /* seek bar */
  const getPct = e => {
    const r = barRef.current?.getBoundingClientRect(); if (!r) return 0;
    const x = e.touches?.[0]?.clientX ?? e.clientX;
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  };
  const onSeekDown = e => {
    e.stopPropagation(); setSeeking(true);
    const pct = getPct(e);
    setProgress(pct * 100);
    if (vidRef.current) vidRef.current.currentTime = pct * (vidRef.current.duration || 0);
  };
  const onSeekMove = e => {
    if (!seeking) { setHPct(getPct(e) * 100); return; }
    const pct = getPct(e);
    setProgress(pct * 100);
    if (vidRef.current) vidRef.current.currentTime = pct * (vidRef.current.duration || 0);
  };
  const onSeekUp = () => setSeeking(false);

  /* volume */
  const setVolume = v => {
    setVol(v);
    if (vidRef.current) { vidRef.current.volume = v; vidRef.current.muted = v === 0; }
    setMuted(v === 0);
  };

  /* fullscreen */
  const toggleFs = () => {
    const el = wrapRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(()=>{});
    else document.exitFullscreen?.();
  };

  const displayProg = progress;

  /* ── Error State ── */
  if (err) return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      gap:14, minHeight:200,
      background:"linear-gradient(160deg,#130d24 0%,#0c0818 100%)",
    }}>
      <div style={{
        width:56, height:56, borderRadius:20,
        background:"rgba(248,113,113,.1)",
        border:"1px solid rgba(248,113,113,.18)",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <AlertTriangle size={24} color="#F87171" strokeWidth={1.5}/>
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:13, fontWeight:800, color:"rgba(255,255,255,.55)", marginBottom:4 }}>ভিডিও লোড হয়নি</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,.28)", lineHeight:1.8 }}>লিংক সঠিক কিনা দেখুন</div>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef}
      onMouseMove={showCtrl}
      onMouseLeave={() => play && setCtrl(false)}
      style={{
        position:"relative",
        background:"linear-gradient(180deg,#0e0820 0%,#09061a 100%)",
        userSelect:"none", overflow:"hidden",
        aspectRatio:"16/9", minHeight:200,
        outline:"none",
        cursor: ctrl ? "default" : "none",
        fontFamily:"Nunito,sans-serif",
      }}>

      {/* ── VIDEO ── */}
      <video ref={vidRef} src={url} preload="metadata" playsInline muted={muted}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        onContextMenu={e => e.preventDefault()}
        onWaiting={()  => setBuf(true)}
        onCanPlay={()  => setBuf(false)}
        onPlaying={()  => setBuf(false)}
        onError={()    => { setErr(true); setPlay(false); setBuf(false); }}
        onEnded={()    => { setPlay(false); setCtrl(true); setEnded(true); }}
        onTimeUpdate={() => {
          const v = vidRef.current; if (!v) return;
          const d = v.duration || 0;
          setCurrent(v.currentTime);
          if (!seeking) setProgress(d ? v.currentTime / d * 100 : 0);
          if (v.buffered.length)
            setBuffered(d ? v.buffered.end(v.buffered.length - 1) / d * 100 : 0);
        }}
        onLoadedMetadata={() => { if (vidRef.current) { setDur(vidRef.current.duration); vidRef.current.volume = vol; } }}
        style={{ width:"100%", height:"100%", display:"block", objectFit:"contain" }}
      />

      {/* soft vignette */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 100% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.25) 100%)",
      }}/>

      {/* ── TAP AREA ── */}
      <div onClick={handleTap} onTouchEnd={handleTap}
        style={{ position:"absolute", inset:0, zIndex:2 }}/>

      {/* ── RIPPLES ── */}
      {ripples.map(r => (
        <div key={r.id} style={{
          position:"absolute", borderRadius:"50%",
          left:r.x, top:r.y, width:12, height:12, marginLeft:-6, marginTop:-6,
          background:"rgba(255,255,255,.2)",
          animation:"softRipple .6s ease-out forwards",
          pointerEvents:"none", zIndex:4,
        }}/>
      ))}

      {/* ── DOUBLE-TAP FLASH ── */}
      {flash && (
        <div style={{
          position:"absolute", inset:0, zIndex:6, pointerEvents:"none",
          display:"flex", alignItems:"center",
          justifyContent: flash.side === "left" ? "flex-start" : "flex-end",
        }}>
          <div style={{
            width:"45%", height:"100%",
            background: flash.side === "left"
              ? "linear-gradient(90deg,rgba(139,92,246,.22),transparent)"
              : "linear-gradient(270deg,rgba(139,92,246,.22),transparent)",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:10,
            animation:"softFlash .5s ease forwards",
          }}>
            <div style={{
              width:46, height:46, borderRadius:"50%",
              background:"rgba(255,255,255,.12)", backdropFilter:"blur(12px)",
              border:"1px solid rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              animation:"softPop .28s cubic-bezier(.34,1.5,.64,1)",
            }}>
              {flash.side === "left"
                ? <RotateCcw size={19} color="white" strokeWidth={2}/>
                : <div style={{transform:"scaleX(-1)",display:"flex"}}><RotateCcw size={19} color="white" strokeWidth={2}/></div>}
            </div>
            <span style={{
              color:"rgba(255,255,255,.9)", fontSize:13, fontWeight:800,
              background:"rgba(0,0,0,.3)", backdropFilter:"blur(8px)",
              padding:"3px 12px", borderRadius:99, letterSpacing:.3,
            }}>{flash.label}</span>
          </div>
        </div>
      )}

      {/* ── BUFFERING ── */}
      {buffering && (
        <div style={{
          position:"absolute", inset:0, zIndex:5,
          display:"flex", alignItems:"center", justifyContent:"center",
          pointerEvents:"none",
        }}>
          <div style={{ position:"relative", width:44, height:44 }}>
            <div style={{
              position:"absolute", inset:0, borderRadius:"50%",
              border:"2px solid rgba(139,92,246,.15)",
              borderTopColor:"rgba(139,92,246,.7)",
              animation:"spin .9s linear infinite",
            }}/>
            <div style={{
              position:"absolute", inset:7, borderRadius:"50%",
              border:"1.5px solid rgba(236,72,153,.12)",
              borderTopColor:"rgba(236,72,153,.6)",
              animation:"spin 1.3s linear infinite reverse",
            }}/>
          </div>
        </div>
      )}

      {/* ── SOFT PLAY / REPLAY OVERLAY ── */}
      {!play && !buffering && (
        <div style={{
          position:"absolute", inset:0, zIndex:3,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16,
          background:"rgba(8,4,20,.45)",
          pointerEvents:"none",
          backdropFilter:"blur(1px)",
        }}>
          {/* outer soft glow */}
          <div style={{
            position:"absolute",
            width:140, height:140, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(139,92,246,.14) 0%, transparent 68%)",
            animation: ended ? "none" : "softPulse 2.8s ease-in-out infinite",
          }}/>

          {/* play button — frosted glass */}
          <div style={{
            width:70, height:70, borderRadius:"50%",
            background:"linear-gradient(145deg, rgba(255,255,255,.22), rgba(255,255,255,.1))",
            backdropFilter:"blur(24px)",
            border:"1.5px solid rgba(255,255,255,.3)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 8px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.25)",
            animation:"softPopIn .32s cubic-bezier(.34,1.4,.64,1)",
          }}>
            {ended
              ? <RefreshCw size={26} color="white" strokeWidth={2}/>
              : <Play size={28} fill="white" color="white" style={{ marginLeft:4 }}/>}
          </div>

          {ended && (
            <span style={{
              color:"rgba(255,255,255,.6)", fontSize:11, fontWeight:700,
              background:"rgba(0,0,0,.35)", backdropFilter:"blur(8px)",
              padding:"4px 14px", borderRadius:99,
            }}>আবার দেখুন</span>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          CONTROLS OVERLAY — soft frosted
      ══════════════════════════════════ */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, zIndex:7,
        opacity: ctrl ? 1 : 0,
        transform: ctrl ? "translateY(0)" : "translateY(4px)",
        transition:"opacity .3s ease, transform .3s ease",
        pointerEvents: ctrl ? "auto" : "none",
      }}>
        {/* soft gradient curtain */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:"linear-gradient(transparent 0%, rgba(5,2,16,.5) 30%, rgba(5,2,16,.93) 100%)",
        }}/>

        <div style={{ position:"relative", padding:"40px 13px 12px" }}>

          {/* ─── SEEK BAR ─── */}
          <div
            onMouseEnter={()=>setBarHov(true)}
            onMouseLeave={()=>{ setBarHov(false); setHPct(null); }}
            onClick={e => e.stopPropagation()}
            style={{ position:"relative", marginBottom:11 }}>

            {/* time tooltip */}
            {hPct !== null && (
              <div style={{
                position:"absolute",
                bottom:"calc(100% + 12px)",
                left:`${Math.max(5, Math.min(91, hPct))}%`,
                transform:"translateX(-50%)",
                background:"rgba(12,6,28,.92)", backdropFilter:"blur(16px)",
                border:"1px solid rgba(139,92,246,.35)",
                color:"rgba(255,255,255,.9)", fontSize:11, fontWeight:800,
                padding:"5px 12px", borderRadius:10, pointerEvents:"none",
                whiteSpace:"nowrap",
                boxShadow:"0 4px 18px rgba(0,0,0,.5)",
              }}>
                {fmt((hPct / 100) * (duration || 0))}
                <div style={{
                  position:"absolute", top:"100%", left:"50%",
                  transform:"translateX(-50%)",
                  borderLeft:"4px solid transparent", borderRight:"4px solid transparent",
                  borderTop:"4px solid rgba(139,92,246,.5)",
                }}/>
              </div>
            )}

            {/* track */}
            <div ref={barRef}
              onMouseMove={onSeekMove} onMouseLeave={() => setHPct(null)}
              onMouseDown={onSeekDown} onMouseUp={onSeekUp}
              onTouchStart={onSeekDown} onTouchMove={onSeekMove} onTouchEnd={onSeekUp}
              style={{
                height: barHov || seeking ? 6 : 3,
                borderRadius:99,
                background:"rgba(255,255,255,.12)",
                cursor:"pointer", position:"relative", overflow:"visible",
                transition:"height .2s ease",
              }}>

              {/* buffered */}
              <div style={{
                position:"absolute", inset:0, width:`${buffered}%`,
                background:"rgba(255,255,255,.18)", borderRadius:99,
                transition:"width .4s", pointerEvents:"none",
              }}/>

              {/* hover ghost fill */}
              {hPct !== null && !seeking && (
                <div style={{
                  position:"absolute", inset:0, width:`${hPct}%`,
                  background:"rgba(255,255,255,.15)", borderRadius:99, pointerEvents:"none",
                }}/>
              )}

              {/* played — soft gradient */}
              <div style={{
                position:"absolute", inset:0, width:`${displayProg}%`,
                background:`linear-gradient(90deg, ${C.purple}, ${C.pink})`,
                borderRadius:99, pointerEvents:"none",
                transition: seeking ? "none" : "width .1s linear",
                boxShadow:"0 0 6px rgba(139,92,246,.35)",
              }}/>

              {/* soft thumb */}
              <div style={{
                position:"absolute", top:"50%",
                left:`${displayProg}%`,
                transform:"translate(-50%,-50%)",
                width: seeking ? 18 : (barHov ? 14 : 10),
                height: seeking ? 18 : (barHov ? 14 : 10),
                borderRadius:"50%", background:"#fff",
                boxShadow: seeking
                  ? `0 0 0 3px rgba(139,92,246,.6), 0 3px 12px rgba(0,0,0,.5)`
                  : `0 0 0 2px rgba(139,92,246,.5), 0 2px 8px rgba(0,0,0,.4)`,
                transition:"width .18s, height .18s",
                pointerEvents:"none",
              }}/>
            </div>
          </div>

          {/* ─── CONTROLS ROW ─── */}
          <div style={{ display:"flex", alignItems:"center", gap:4 }}
            onClick={e => e.stopPropagation()}>

            {/* Play/Pause */}
            <SBtn onClick={toggle}>
              {play
                ? <Pause size={16} fill="white" color="white"/>
                : <Play  size={16} fill="white" color="white" style={{marginLeft:1}}/>}
            </SBtn>

            {/* –10s */}
            <SBtn onClick={()=>{ const v=vidRef.current; if(v) v.currentTime=Math.max(0,v.currentTime-10); doFlash("left","−10s"); }}>
              <RotateCcw size={13} strokeWidth={2}/>
            </SBtn>

            {/* +10s */}
            <SBtn onClick={()=>{ const v=vidRef.current; if(v) v.currentTime=Math.min(v.duration||0,v.currentTime+10); doFlash("right","+10s"); }}>
              <div style={{transform:"scaleX(-1)",display:"flex"}}><RotateCcw size={13} strokeWidth={2}/></div>
            </SBtn>

            {/* Volume */}
            <div style={{ position:"relative" }}
              onMouseEnter={()=>setShowVol(true)} onMouseLeave={()=>setShowVol(false)}>
              <SBtn onClick={()=>{ const nm=!muted; setMuted(nm); if(vidRef.current) vidRef.current.muted=nm; }}>
                {muted||vol===0
                  ? <VolumeX size={14} strokeWidth={2}/>
                  : <Volume2 size={14} strokeWidth={2} style={{opacity: vol < 0.5 ? .6 : 1}}/>}
              </SBtn>
              {showVol && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 8px)", left:"50%",
                  transform:"translateX(-50%)",
                  background:"rgba(10,5,24,.92)", backdropFilter:"blur(18px)",
                  border:"1px solid rgba(255,255,255,.1)",
                  borderRadius:16, padding:"14px 11px 10px",
                  boxShadow:"0 12px 36px rgba(0,0,0,.55)",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                }}>
                  <div style={{
                    height:70, width:4, borderRadius:99,
                    background:"rgba(255,255,255,.1)", position:"relative", cursor:"pointer",
                  }}
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setVolume(1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
                    }}>
                    <div style={{
                      position:"absolute", bottom:0, left:0, right:0,
                      height:`${(muted?0:vol)*100}%`,
                      background:`linear-gradient(to top,${C.purple},${C.pink})`,
                      borderRadius:99, pointerEvents:"none",
                    }}/>
                    <div style={{
                      position:"absolute", left:"50%",
                      bottom:`${(muted?0:vol)*100}%`, transform:"translate(-50%,50%)",
                      width:11, height:11, borderRadius:"50%", background:"#fff",
                      boxShadow:`0 0 0 2px rgba(139,92,246,.55)`,
                      pointerEvents:"none",
                    }}/>
                  </div>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,.4)", fontWeight:700 }}>
                    {muted ? "0" : Math.round(vol*100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Time */}
            <span style={{ flex:1, minWidth:0, fontSize:11, fontWeight:700, letterSpacing:.2 }}>
              <span style={{ color:"rgba(255,255,255,.9)" }}>{fmt(current)}</span>
              <span style={{ color:"rgba(255,255,255,.22)", margin:"0 4px" }}>/</span>
              <span style={{ color:"rgba(255,255,255,.4)", fontSize:10 }}>{fmt(duration)}</span>
            </span>

            {/* Speed */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>setShowSpd(s=>!s)} style={{
                height:26, padding:"0 9px",
                background: showSpd
                  ? `linear-gradient(135deg,${C.purple},${C.pink})`
                  : "rgba(255,255,255,.09)",
                border:`1px solid ${showSpd ? "transparent" : "rgba(255,255,255,.12)"}`,
                borderRadius:8, cursor:"pointer",
                color: showSpd ? "#fff" : "rgba(255,255,255,.7)",
                fontSize:11, fontWeight:900, fontFamily:"Nunito,sans-serif",
                transition:"all .22s",
              }}>
                {speed}×
              </button>
              {showSpd && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 8px)", right:0,
                  background:"rgba(8,4,20,.96)", backdropFilter:"blur(20px)",
                  border:"1px solid rgba(255,255,255,.1)",
                  borderRadius:14, overflow:"hidden",
                  boxShadow:"0 12px 36px rgba(0,0,0,.6)",
                }}>
                  {SPEEDS.map(s2 => (
                    <button key={s2} onClick={()=>{
                      setSpeed(s2);
                      if(vidRef.current) vidRef.current.playbackRate = s2;
                      setShowSpd(false);
                    }} style={{
                      display:"flex", alignItems:"center", gap:8,
                      width:"100%", padding:"8px 20px",
                      background: speed===s2 ? `linear-gradient(135deg,${C.purple},${C.pink})` : "none",
                      border:"none", cursor:"pointer",
                      color: speed===s2 ? "#fff" : "rgba(255,255,255,.55)",
                      fontSize:12, fontWeight:800, fontFamily:"Nunito,sans-serif",
                      borderBottom:"1px solid rgba(255,255,255,.05)",
                      transition:"background .15s",
                    }}>
                      {speed===s2 && <div style={{ width:4, height:4, borderRadius:"50%", background:"#fff", flexShrink:0 }}/>}
                      {s2}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <SBtn onClick={toggleFs}>
              {isFs
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                : <Maximize2 size={13} strokeWidth={2}/>}
            </SBtn>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes softRipple{0%{transform:scale(1);opacity:.6}100%{transform:scale(18);opacity:0}}
        @keyframes softFlash{0%{opacity:1}70%{opacity:.6}100%{opacity:0}}
        @keyframes softPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes softPopIn{from{transform:scale(.65);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes softPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}
      `}</style>
    </div>
  );
}

/* Soft icon button */
function SBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        width:32, height:32, borderRadius:10,
        background:"rgba(255,255,255,.08)",
        border:"1px solid rgba(255,255,255,.09)",
        backdropFilter:"blur(10px)",
        cursor:"pointer", color:"rgba(255,255,255,.78)",
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all .22s cubic-bezier(.34,1.3,.64,1)", flexShrink:0,
        fontFamily:"Nunito,sans-serif",
      }}
      onMouseEnter={e=>{
        e.currentTarget.style.background="rgba(139,92,246,.22)";
        e.currentTarget.style.borderColor="rgba(139,92,246,.38)";
        e.currentTarget.style.transform="scale(1.1)";
        e.currentTarget.style.color="#fff";
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.background="rgba(255,255,255,.08)";
        e.currentTarget.style.borderColor="rgba(255,255,255,.09)";
        e.currentTarget.style.transform="scale(1)";
        e.currentTarget.style.color="rgba(255,255,255,.78)";
      }}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   IFRAME PLAYER — generic soft embed for all non-YouTube platforms
══════════════════════════════════════════════════════════════ */
function IframePlayer({ url, type }) {
  const [ready, setReady] = useState(false);
  const meta = TYPE_META[type] || TYPE_META.embed;
  const embedUrl = getEmbed(url, type);

  return (
    <div style={{
      position:"relative", paddingBottom:"56.25%",
      background:`linear-gradient(160deg,#0e0820,#09061a)`,
      overflow:"hidden",
    }}>
      {/* soft loading shimmer before iframe loads */}
      {!ready && (
        <div style={{
          position:"absolute", inset:0, zIndex:2,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          pointerEvents:"none",
        }}>
          <div style={{
            width:48, height:48, borderRadius:16,
            background:`${meta.color}18`,
            border:`1px solid ${meta.color}30`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{
              width:22, height:22, borderRadius:"50%",
              border:`2px solid ${meta.color}25`,
              borderTopColor:meta.color,
              animation:"spin .9s linear infinite",
            }}/>
          </div>
          <span style={{
            fontSize:11, fontWeight:700,
            color:"rgba(255,255,255,.35)",
            background:"rgba(255,255,255,.06)",
            padding:"4px 12px", borderRadius:99,
          }}>{meta.label} লোড হচ্ছে…</span>
        </div>
      )}
      <iframe
        src={embedUrl}
        onLoad={() => setReady(true)}
        style={{
          position:"absolute", inset:0,
          width:"100%", height:"100%", border:"none",
          opacity: ready ? 1 : 0,
          transition:"opacity .4s ease",
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VIDEO PLAYER ROUTER — picks the right player for each format
══════════════════════════════════════════════════════════════ */
function VideoPlayer({ url }) {
  const type = detectType(url);
  if (type === "youtube")  return <YoutubePlayer url={url}/>;
  if (type === "direct")   return <CustomPlayer  url={url}/>;
  // dropbox direct → convert to raw link for CustomPlayer
  if (type === "dropbox") {
    const raw = url.replace("www.dropbox.com","dl.dropboxusercontent.com").replace("?dl=0","").replace("?dl=1","");
    return <CustomPlayer url={raw}/>;
  }
  // everything else → iframe embed with loading state
  return <IframePlayer url={url} type={type}/>;
}

/* Three-dot card menu */
function CardMenu({ v, open, onClose, onDelete, onSave, saved, canDelete, showToast }) {
  if (!open) return null;
  const Row = ({ icon, label, color, onClick, danger, last }) => (
    <button onClick={() => { onClick?.(); onClose(); }} style={{
      display:"flex", alignItems:"center", gap:12, width:"100%",
      padding:"11px 0", background:"none", border:"none",
      borderBottom:last ? "none" : `1px solid ${C.border}`,
      cursor:"pointer", fontFamily:"Nunito,sans-serif",
      color:danger ? "#FC8181" : (color || C.text),
      transition:"opacity .15s",
    }}>
      <div style={{
        width:36, height:36, borderRadius:12, flexShrink:0,
        background:danger ? "#FFF5F5" : (color ? `${color}14` : C.purpleL),
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>{icon}</div>
      <span style={{ fontWeight:700, fontSize:14, flex:1, textAlign:"left" }}>{label}</span>
      <ChevronRight size={12} color={C.sub}/>
    </button>
  );
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:500,
      background:"rgba(20,12,50,.22)", backdropFilter:"blur(16px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"100%", maxWidth:520,
        background:"rgba(255,255,255,.98)", backdropFilter:"blur(20px)",
        borderRadius:"32px 32px 0 0", padding:"10px 0 0",
        boxShadow:"0 -12px 48px rgba(155,127,232,.12)",
        animation:"sheetUp .3s cubic-bezier(.34,1.3,.64,1)",
      }}>
        <div style={{
          width:40, height:4, borderRadius:99,
          background:"linear-gradient(90deg,#E5DEFF,#FBD0E8)",
          margin:"0 auto 16px",
        }}/>
        <div style={{ padding:"0 20px" }}>
          {/* video info card */}
          <div style={{
            display:"flex", alignItems:"center", gap:11,
            background:`linear-gradient(135deg,${C.purpleL},${C.pinkL})`,
            borderRadius:18, padding:"11px 13px", marginBottom:14,
            border:`1px solid ${C.border}`,
          }}>
            <div style={{
              width:38, height:38, borderRadius:13, flexShrink:0,
              background:`linear-gradient(135deg,${C.purple},${C.pink})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 4px 12px ${C.s2}`,
            }}><Video size={16} color="white" strokeWidth={1.8}/></div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:13, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.title}</div>
              <div style={{ fontSize:11, color:C.sub, fontWeight:600, marginTop:1 }}>{v.author} · {v.views} views</div>
            </div>
          </div>
          <Row icon={<Share2 size={14} color={C.purple} strokeWidth={2}/>} label="লিংক কপি করুন" onClick={() => { try { navigator.clipboard.writeText(v.url); } catch {} showToast("লিংক কপি হয়েছে!"); }}/>
          <Row icon={<Bookmark size={14} color={saved?C.gold:C.purple} strokeWidth={2}/>} label={saved?"সেভ থেকে সরান":"পরে দেখার জন্য সেভ"} color={saved?C.gold:undefined} onClick={() => { onSave(v.id); showToast(saved?"সেভ সরানো হয়েছে":"সেভ হয়েছে!"); }}/>
          <Row icon={<Flag size={14} color="#F5A05A" strokeWidth={2}/>} label="রিপোর্ট করুন" color="#F5A05A" onClick={() => showToast("রিপোর্ট পাঠানো হয়েছে")}/>
          {canDelete && <Row icon={<Trash2 size={14} color="#FC8181" strokeWidth={2}/>} label="ভিডিও ডিলিট করুন" danger onClick={() => { onDelete(v.id); showToast("ভিডিও মুছে ফেলা হয়েছে"); }} last/>}
        </div>
        <div style={{ padding:"12px 20px 36px" }}>
          <button onClick={onClose} style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            width:"100%", padding:"13px",
            background:C.purpleL, border:`1px solid ${C.purpleM}`,
            borderRadius:16, fontWeight:800, fontSize:14,
            color:C.purple, cursor:"pointer",
            fontFamily:"Nunito,sans-serif", gap:7,
            transition:"background .2s",
          }}>
            <X size={13} strokeWidth={2.5}/>বাতিল
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ v, liked, onLike, onDelete, saved, onSave, canDelete, showToast }) {
  const [more, setMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vidActive, setVidActive] = useState(false);
  const isAP = v.author === ADMIN;
  return (
    <>
      <div style={{
        background:"rgba(255,255,255,.95)",
        borderRadius:28, marginBottom:14,
        overflow:"hidden",
        border:`1px solid ${vidActive ? "rgba(155,127,232,.3)" : "rgba(229,222,255,.7)"}`,
        boxShadow: vidActive
          ? "0 4px 32px rgba(155,127,232,.14)"
          : "0 2px 20px rgba(155,127,232,.06)",
        transition:"box-shadow .35s, border-color .35s",
      }}>
        {/* author row */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 14px 10px" }}>
          <div style={{
            width:40, height:40, borderRadius:14, flexShrink:0,
            background:isAP
              ? `linear-gradient(145deg,${C.gold},#FB923C)`
              : `linear-gradient(145deg,${C.purple},${C.pink})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:isAP
              ? "0 4px 14px rgba(245,166,35,.25)"
              : "0 4px 14px rgba(155,127,232,.22)",
          }}>
            {isAP ? <Crown size={17} color="white" strokeWidth={2}/> : <User size={17} color="white" strokeWidth={2}/>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontWeight:800, fontSize:14, color:C.text }}>{v.author}</span>
              {isAP && (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:3,
                  background:C.goldL, color:C.gold,
                  fontSize:9, fontWeight:800,
                  padding:"2px 7px", borderRadius:99,
                  border:`1px solid ${C.goldM}`,
                }}><Crown size={8}/>Admin</span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
              <Clock size={9} color={C.sub} strokeWidth={2}/>
              <span style={{ fontSize:10, color:C.sub, fontWeight:600 }}>{ago(v.ts)}</span>
            </div>
          </div>
          <TypeBadge url={v.url}/>
          <button onClick={() => setMenuOpen(true)} style={{
            width:32, height:32, borderRadius:10,
            background:C.purpleL, border:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", marginLeft:4, flexShrink:0,
            transition:"background .2s",
          }}>
            <MoreVertical size={13} color={C.sub} strokeWidth={2}/>
          </button>
        </div>

        {/* title & desc */}
        <div style={{ padding:"0 14px 10px" }}>
          <div style={{ fontWeight:800, fontSize:15, color:C.text, lineHeight:1.45, marginBottom:4 }}>{v.title}</div>
          {v.desc && (
            <div style={{ fontSize:12, color:C.sub, lineHeight:1.65, fontWeight:500 }}>
              {more || v.desc.length < 90
                ? v.desc
                : <>{v.desc.slice(0,90)}<span onClick={() => setMore(true)} style={{ color:C.purple, fontWeight:700, cursor:"pointer" }}> ...আরো</span></>
              }
            </div>
          )}
        </div>

        {/* video */}
        <div onClick={() => { setVidActive(true); if (!vidActive) fbIncrView(v.id); }}>
          <VideoPlayer url={v.url}/>
        </div>

        {/* action row */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px" }}>
          <button onClick={() => onLike(v.id)} style={{
            display:"flex", alignItems:"center", gap:5,
            background:liked ? C.pinkL : C.purpleL,
            border:`1px solid ${liked ? C.pinkM : C.purpleM}`,
            borderRadius:12, padding:"7px 13px",
            cursor:"pointer", fontWeight:700, fontSize:13,
            color:liked ? C.pink : C.purple,
            fontFamily:"Nunito,sans-serif",
            transition:"all .25s cubic-bezier(.34,1.3,.64,1)",
          }}>
            <Heart size={13} fill={liked ? C.pink : "none"} color={liked ? C.pink : C.purple} strokeWidth={2}/>
            {v.likes || 0}
          </button>

          <div style={{
            display:"flex", alignItems:"center", gap:5,
            background:C.purpleL, border:`1px solid ${C.purpleM}`,
            borderRadius:12, padding:"7px 13px",
            fontSize:13, fontWeight:700, color:C.purple,
          }}>
            <Eye size={13} strokeWidth={2}/>{v.views}
          </div>

          <button onClick={() => { onSave(v.id); showToast(saved ? "সেভ সরানো হয়েছে" : "সেভ হয়েছে!"); }} style={{
            display:"flex", alignItems:"center", marginLeft:"auto",
            background:saved ? C.goldL : C.purpleL,
            border:`1px solid ${saved ? C.goldM : C.purpleM}`,
            borderRadius:12, padding:"7px 11px",
            cursor:"pointer", color:saved ? C.gold : C.sub,
            fontFamily:"Nunito,sans-serif",
            transition:"all .25s",
          }}>
            <Bookmark size={13} fill={saved ? C.gold : "none"} strokeWidth={2}/>
          </button>
        </div>
      </div>
      <CardMenu v={v} open={menuOpen} onClose={() => setMenuOpen(false)}
        onDelete={onDelete} onSave={onSave} saved={saved}
        canDelete={canDelete} showToast={showToast}/>
    </>
  );
}

/* Add Form — available to ALL users */
function AddForm({ onDone, onClose, authorName, isAdmin }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlType, setUrlType] = useState(null);

  const inp = { width:"100%", padding:"12px 13px", background:C.purpleL, border:`1.5px solid ${C.border}`, borderRadius:13, fontSize:14, color:C.text, fontFamily:"Nunito,sans-serif", fontWeight:600, marginBottom:11, display:"block" };

  const checkUrl = u => { setUrl(u); setErr(""); if (u.trim().length > 8) setUrlType(detectType(u.trim())); else setUrlType(null); };

  const typeInfo = urlType && (TYPE_META[urlType] || TYPE_META.embed);

  const submit = () => {
    if (!url.trim()) { setErr("ভিডিও লিংক দিন"); return; }
    if (!title.trim()) { setErr("টাইটেল দিন"); return; }
    setBusy(true); setErr("");
    setTimeout(() => { onDone({ id:`v${Date.now()}`, url:url.trim(), title:title.trim(), desc:desc.trim(), author:authorName, ts:Date.now(), likes:0, views:0 }); setBusy(false); }, 400);
  };

  /* all supported platform chips */
  const CHIPS = [
    { label:"YouTube",   c:"#DC2626", bg:"#FEF2F2" },
    { label:"Facebook",  c:"#1D4ED8", bg:"#EFF6FF" },
    { label:"Instagram", c:"#BE185D", bg:"#FDF2F8" },
    { label:"TikTok",    c:"#0F766E", bg:"#F0FDFA" },
    { label:"Vimeo",     c:"#16A34A", bg:"#F0FDF4" },
    { label:"Twitch",    c:"#6D28D9", bg:"#F5F3FF" },
    { label:"Dailymotion",c:"#EA580C",bg:"#FFF7ED" },
    { label:"Bilibili",  c:"#E11D48", bg:"#FFF0F0" },
    { label:"Rumble",    c:"#C2410C", bg:"#FFF7ED" },
    { label:"Odysee",    c:"#BE123C", bg:"#FFF1F2" },
    { label:"Streamable",c:"#0E7490", bg:"#F0FDFF" },
    { label:"Loom",      c:"#B45309", bg:"#FFF7ED" },
    { label:"Drive",     c:"#2563EB", bg:"#EFF6FF" },
    { label:"Dropbox",   c:"#1E40AF", bg:"#EFF6FF" },
    { label:"OneDrive",  c:"#1D4ED8", bg:"#EFF6FF" },
    { label:"Archive",   c:"#475569", bg:"#F8FAFC" },
    { label:"Wistia",    c:"#A16207", bg:"#FEFCE8" },
    { label:"Bunny",     c:"#E11D48", bg:"#FFF1F2" },
    { label:"PeerTube",  c:"#15803D", bg:"#F0FDF4" },
    { label:"MP4/WebM",  c:"#7C3AED", bg:"#F5F3FF" },
    { label:"MKV/AVI",   c:"#7C3AED", bg:"#F5F3FF" },
    { label:"MOV/WMV",   c:"#7C3AED", bg:"#F5F3FF" },
    { label:"& আরো...", c:"#64748B", bg:"#F8FAFC" },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <div style={{ width:34, height:34, borderRadius:12, background:`linear-gradient(135deg,${C.purple},${C.pink})`, display:"flex", alignItems:"center", justifyContent:"center" }}><Plus size={18} color="white" strokeWidth={2.5}/></div>
            <span style={{ fontWeight:900, fontSize:18, color:C.text }}>ভিডিও শেয়ার করুন</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:42 }}>
            {isAdmin ? <Crown size={11} color={C.gold}/> : <User size={11} color={C.sub}/>}
            <span style={{ fontSize:11, color:isAdmin?C.gold:C.sub, fontWeight:700 }}>{authorName}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ width:34, height:34, borderRadius:11, background:C.purpleL, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={15} color={C.sub}/></button>
      </div>

      {/* ── Supported Platforms scrollable chip list ── */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:800, color:C.sub, letterSpacing:.6, marginBottom:7 }}>সাপোর্টেড প্ল্যাটফর্ম ও ফরম্যাট</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {CHIPS.map((t,i) => (
            <span key={i} style={{
              display:"inline-flex", alignItems:"center",
              background:t.bg, color:t.c,
              fontSize:9, fontWeight:800, padding:"3px 9px",
              borderRadius:99, border:`1px solid ${t.c}20`,
            }}>{t.label}</span>
          ))}
        </div>
      </div>

      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>টাইটেল</label>
      <input style={inp} placeholder="ভিডিওর নাম লিখুন..." value={title} onChange={e=>setTitle(e.target.value)}/>

      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>ভিডিও লিংক</label>
      <input style={{...inp, borderColor:urlType?C.purple:C.border}} placeholder="https://..." value={url} onChange={e=>checkUrl(e.target.value)}/>

      {urlType && typeInfo && (
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:typeInfo.bg, border:`1px solid ${typeInfo.color}30`,
          borderRadius:11, padding:"9px 13px", marginBottom:11, marginTop:-8,
        }}>
          <CheckCircle size={13} color={typeInfo.color} strokeWidth={2.5}/>
          <span style={{ fontSize:12, fontWeight:700, color:typeInfo.color }}>
            {typeInfo.label} শনাক্ত হয়েছে ✓
          </span>
        </div>
      )}

      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>বিবরণ <span style={{ fontWeight:400 }}>(ঐচ্ছিক)</span></label>
      <textarea style={{...inp, minHeight:78, resize:"vertical"}} placeholder="ভিডিওটি সম্পর্কে লিখুন..." value={desc} onChange={e=>setDesc(e.target.value)}/>

      {err && <div style={{ display:"flex", alignItems:"center", gap:7, color:C.error, fontSize:13, fontWeight:700, marginBottom:11 }}><AlertTriangle size={13}/>{err}</div>}

      <button onClick={submit} disabled={busy} style={{ width:"100%", padding:"13px", background:busy?C.purpleM:`linear-gradient(135deg,${C.purple},${C.pink})`, border:"none", borderRadius:15, color:"#fff", fontWeight:900, fontSize:15, cursor:busy?"not-allowed":"pointer", fontFamily:"Nunito,sans-serif", boxShadow:busy?"none":`0 8px 24px rgba(139,92,246,.35)`, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {busy ? <><div style={{ width:15, height:15, borderRadius:"50%", border:"2px solid rgba(255,255,255,.4)", borderTopColor:"#fff", animation:"spin .7s linear infinite" }}/>যোগ হচ্ছে...</> : <><Sparkles size={16}/>পাবলিশ করুন</>}
      </button>
    </div>
  );
}

/* AI metadata generator */
async function aiMeta(filename) {
  try {
    const clean = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:200, messages:[{role:"user",content:`Filename: "${clean}". Bengali title (max 7 words) and description (max 18 words). JSON only: {"title":"...","desc":"..."}`}] }) });
    const d = await res.json();
    return JSON.parse((d.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim());
  } catch { return null; }
}

/* GitHub AI Import Panel */
function GitHubPanel({ onClose, onImport, showToast, existingUrls }) {
  const [owner,setOwner] = useState("");
  const [repo,setRepo] = useState("");
  const [token,setToken] = useState("");
  const [folder,setFolder] = useState("");
  const [scanning,setScanning] = useState(false);
  const [found,setFound] = useState([]);
  const [status,setStatus] = useState("");
  const [aiLoading,setAiLoading] = useState(false);

  const inp = { width:"100%", padding:"11px 13px", background:C.purpleL, border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:13, color:C.text, fontFamily:"Nunito,sans-serif", fontWeight:600, marginBottom:10, display:"block" };

  const scan = async () => {
    if (!owner.trim()||!repo.trim()) { showToast("Owner ও Repo দিন"); return; }
    setScanning(true); setFound([]); setStatus("স্ক্যান হচ্ছে...");
    const hdrs = { Accept:"application/vnd.github+json" };
    if (token.trim()) hdrs["Authorization"] = `Bearer ${token.trim()}`;
    const dig = async p => {
      try {
        const r = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}/contents/${p}`,{headers:hdrs});
        if (!r.ok) throw new Error(`${r.status}`);
        const items = await r.json();
        const vids = [];
        for (const item of items) {
          if (item.type==="file"&&VEXT.test(item.name)) vids.push({name:item.name,url:item.download_url,path:item.path,size:item.size});
          else if (item.type==="dir") vids.push(...await dig(item.path));
        }
        return vids;
      } catch(e) { setStatus(`ত্রুটি: ${e.message}`); return []; }
    };
    const all = await dig(folder.trim()||"");
    const fresh = all.filter(v => !existingUrls.has(v.url));
    setFound(fresh);
    setStatus(all.length===0?"কোনো ভিডিও নেই":`${all.length}টি পাওয়া গেছে (${fresh.length}টি নতুন)`);
    setScanning(false);
  };

  const importAll = async () => {
    if (!found.length) { showToast("কোনো নতুন ভিডিও নেই"); return; }
    setAiLoading(true);
    const toAdd = [];
    for (const f of found) {
      setStatus(`AI: "${f.name}"...`);
      const meta = await aiMeta(f.name);
      toAdd.push({ id:`gh_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, url:f.url, title:meta?.title||f.name.replace(/\.[^.]+$/,""), desc:meta?.desc||"", author:ADMIN, ts:Date.now(), likes:0, views:0 });
    }
    onImport(toAdd);
    setStatus(`✅ ${toAdd.length}টি ইম্পোর্ট হয়েছে`);
    setAiLoading(false);
    showToast(`${toAdd.length}টি ভিডিও যোগ হয়েছে!`,true);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:13, background:"linear-gradient(135deg,#1f2937,#374151)", display:"flex", alignItems:"center", justifyContent:"center" }}><Github size={20} color="white" strokeWidth={1.8}/></div>
          <div><div style={{ fontWeight:900, fontSize:17, color:C.text }}>GitHub ইম্পোর্ট</div><div style={{ display:"flex", alignItems:"center", gap:4 }}><Zap size={10} color={C.gold}/><span style={{ fontSize:11, color:C.gold, fontWeight:700 }}>AI-Powered</span></div></div>
        </div>
        <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:C.purpleL, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14} color={C.sub}/></button>
      </div>
      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>OWNER</label>
      <input style={inp} placeholder="username" value={owner} onChange={e=>setOwner(e.target.value)}/>
      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>REPOSITORY</label>
      <input style={inp} placeholder="my-videos" value={repo} onChange={e=>setRepo(e.target.value)}/>
      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>FOLDER <span style={{ fontWeight:400 }}>(খালি = root)</span></label>
      <input style={inp} placeholder="videos/2024" value={folder} onChange={e=>setFolder(e.target.value)}/>
      <label style={{ fontWeight:700, fontSize:11, color:C.sub, display:"block", marginBottom:4, letterSpacing:.5 }}>TOKEN <span style={{ fontWeight:400 }}>(private repo)</span></label>
      <input style={inp} type="password" placeholder="ghp_xxxx (optional)" value={token} onChange={e=>setToken(e.target.value)}/>
      {status && <div style={{ display:"flex", alignItems:"center", gap:8, background:C.goldL, border:`1px solid ${C.goldM}`, borderRadius:11, padding:"9px 13px", marginBottom:12 }}>
        {(scanning||aiLoading) && <div style={{ width:13, height:13, borderRadius:"50%", border:`2px solid ${C.purpleM}`, borderTopColor:C.purple, animation:"spin .7s linear infinite", flexShrink:0 }}/>}
        <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{status}</span>
      </div>}
      {found.length>0 && <div style={{ background:C.purpleL, border:`1px solid ${C.purpleM}`, borderRadius:13, padding:"11px 13px", marginBottom:13, maxHeight:150, overflowY:"auto" }}>
        <div style={{ fontWeight:800, fontSize:11, color:C.purple, marginBottom:8 }}>{found.length}টি নতুন:</div>
        {found.map((f,i)=><div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 0", borderBottom:i<found.length-1?`1px solid ${C.border}`:"none" }}>
          <Video size={12} color={C.purple} strokeWidth={2}/><span style={{ fontSize:11, color:C.text, fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
          <span style={{ fontSize:10, color:C.sub }}>{f.size?(f.size/1024/1024).toFixed(1)+"MB":""}</span>
        </div>)}
      </div>}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={scan} disabled={scanning||aiLoading} style={{ flex:1, padding:"12px", background:scanning?C.purpleM:"linear-gradient(135deg,#1f2937,#374151)", border:"none", borderRadius:13, color:"#fff", fontWeight:800, fontSize:13, cursor:scanning?"not-allowed":"pointer", fontFamily:"Nunito,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {scanning?<><div style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,.4)", borderTopColor:"#fff", animation:"spin .7s linear infinite" }}/>স্ক্যান...</>:<><RefreshCw size={13}/>স্ক্যান</>}
        </button>
        {found.length>0 && <button onClick={importAll} disabled={aiLoading||scanning} style={{ flex:1, padding:"12px", background:aiLoading?C.purpleM:`linear-gradient(135deg,${C.purple},${C.pink})`, border:"none", borderRadius:13, color:"#fff", fontWeight:800, fontSize:13, cursor:aiLoading?"not-allowed":"pointer", fontFamily:"Nunito,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6, boxShadow:`0 6px 20px rgba(139,92,246,.35)` }}>
          {aiLoading?<><div style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,.4)", borderTopColor:"#fff", animation:"spin .7s linear infinite" }}/>AI...</>:<><Zap size={13}/>AI ইম্পোর্ট</>}
        </button>}
      </div>
    </div>
  );
}

/* Login Screen */
function LoginScreen({ onLogin }) {
  const [name,setName] = useState("");
  const [err,setErr] = useState("");
  const [focused,setFocused] = useState(false);
  const isA = name.trim() === ADMIN;

  const submit = () => {
    const n = name.trim();
    if (!n) { setErr("নাম দিন"); return; }
    if (n.length < 2) { setErr("কমপক্ষে ২ অক্ষর দিন"); return; }
    onLogin(n);
  };

  return (
    <div style={{
      minHeight:"100vh", width:"100%",
      background:`
        radial-gradient(ellipse 80% 60% at 15% 15%, rgba(229,222,255,.7) 0%, transparent 55%),
        radial-gradient(ellipse 70% 50% at 85% 85%, rgba(251,208,232,.55) 0%, transparent 55%),
        radial-gradient(ellipse 60% 60% at 50% 50%, rgba(247,245,255,.9) 0%, transparent 80%),
        #F7F5FF
      `,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"24px 20px", fontFamily:"Nunito,sans-serif",
    }}>

      {/* floating soft orbs */}
      <div style={{ position:"fixed", top:"8%", right:"10%", width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle,rgba(155,127,232,.12) 0%,transparent 70%)", pointerEvents:"none" }}/>
      <div style={{ position:"fixed", bottom:"15%", left:"5%", width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle,rgba(232,121,160,.1) 0%,transparent 70%)", pointerEvents:"none" }}/>

      {/* logo area */}
      <div style={{ textAlign:"center", marginBottom:40, position:"relative" }}>
        <div style={{
          width:90, height:90, borderRadius:30,
          background:"linear-gradient(145deg,rgba(255,255,255,.9),rgba(240,235,255,.8))",
          backdropFilter:"blur(20px)",
          border:"1.5px solid rgba(229,222,255,.8)",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 18px",
          boxShadow:"0 12px 40px rgba(155,127,232,.18), inset 0 1px 0 rgba(255,255,255,.9)",
        }}>
          <div style={{
            width:54, height:54, borderRadius:18,
            background:`linear-gradient(145deg,${C.purple},${C.pink})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 8px 24px rgba(155,127,232,.35)`,
          }}>
            <Video size={26} color="white" strokeWidth={1.8}/>
          </div>
        </div>
        <div style={{ fontWeight:900, fontSize:32, color:C.text, letterSpacing:-1, lineHeight:1 }}>VideoHub</div>
        <div style={{ fontSize:13, color:C.sub, fontWeight:600, marginTop:6, letterSpacing:.2 }}>সবার জন্য · যেকোনো ফরম্যাট</div>
      </div>

      {/* login card */}
      <div style={{
        width:"100%", maxWidth:380,
        background:"rgba(255,255,255,.85)",
        backdropFilter:"blur(24px)",
        borderRadius:32, padding:"28px 24px 26px",
        boxShadow:"0 8px 48px rgba(155,127,232,.12), 0 1px 0 rgba(255,255,255,.9)",
        border:"1.5px solid rgba(229,222,255,.6)",
      }}>
        <div style={{ fontWeight:900, fontSize:22, color:C.text, marginBottom:4 }}>স্বাগতম 👋</div>
        <div style={{ fontSize:13, color:C.sub, marginBottom:20, fontWeight:500, lineHeight:1.6 }}>
          যেকোনো নামে লগইন করে ভিডিও শেয়ার করুন
        </div>

        {/* input */}
        <div style={{ position:"relative", marginBottom:12 }}>
          <div style={{
            position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
            color:isA ? C.gold : (focused ? C.purple : C.sub),
            transition:"color .2s",
          }}>
            {isA ? <Crown size={16} strokeWidth={2}/> : <User size={16} strokeWidth={2}/>}
          </div>
          <input value={name}
            onChange={e=>{setName(e.target.value);setErr("");}}
            onFocus={()=>setFocused(true)}
            onBlur={()=>setFocused(false)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="আপনার নাম লিখুন..."
            style={{
              width:"100%", padding:"14px 14px 14px 42px",
              background:focused ? "rgba(255,255,255,.95)" : C.purpleL,
              border:`1.5px solid ${focused ? (isA?C.gold:C.purple) : C.border}`,
              borderRadius:16, fontSize:15, color:C.text,
              fontFamily:"Nunito,sans-serif", fontWeight:700,
              outline:"none", boxSizing:"border-box",
              transition:"all .25s",
              boxShadow:focused ? `0 0 0 3px ${isA?"rgba(245,166,35,.12)":"rgba(155,127,232,.12)"}` : "none",
            }}/>
        </div>

        {/* admin badge */}
        {isA && (
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            background:`linear-gradient(135deg,${C.goldL},rgba(255,251,240,.8))`,
            border:`1px solid ${C.goldM}`, borderRadius:16,
            padding:"11px 14px", marginBottom:14,
          }}>
            <div style={{
              width:34, height:34, borderRadius:11, flexShrink:0,
              background:`linear-gradient(145deg,${C.gold},#FB923C)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 12px rgba(245,166,35,.3)",
            }}><Crown size={16} color="white" strokeWidth={2}/></div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"#92400E" }}>Admin অ্যাক্সেস</div>
              <div style={{ fontSize:11, color:"#B45309", fontWeight:500 }}>সব ফিচার ও কন্ট্রোল আনলক</div>
            </div>
          </div>
        )}

        {err && (
          <div style={{
            display:"flex", alignItems:"center", gap:7,
            color:C.error, fontSize:13, fontWeight:700,
            marginBottom:12, padding:"9px 12px",
            background:"#FFF5F5", borderRadius:12,
            border:"1px solid #FED7D7",
          }}>
            <AlertTriangle size={12}/>{err}
          </div>
        )}

        <button onClick={submit} style={{
          width:"100%", padding:"14px",
          background:`linear-gradient(145deg,${C.purple},${C.pink})`,
          border:"none", borderRadius:16,
          color:"#fff", fontWeight:800, fontSize:15,
          cursor:"pointer", fontFamily:"Nunito,sans-serif",
          boxShadow:`0 8px 28px rgba(155,127,232,.32)`,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          transition:"transform .2s, box-shadow .2s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 12px 36px rgba(155,127,232,.4)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 8px 28px rgba(155,127,232,.32)";}}>
          প্রবেশ করুন <ChevronRight size={16} strokeWidth={2.5}/>
        </button>
      </div>

      <div style={{ marginTop:20, display:"flex", alignItems:"center", gap:6, color:C.sub }}>
        <Globe size={11} strokeWidth={2}/>
        <span style={{ fontSize:11, fontWeight:600 }}>সারাবিশ্বে দেখা যাবে</span>
      </div>
    </div>
  );
}

/* Admin Control Panel */
function ProfileSheet({ user, onLogout, onClose, allVideos, allUsers, onDeleteVideo, onDeleteUser, showToast }) {
  const isAdmin = user === ADMIN;
  const [aTab, setATab] = useState("users");
  const myVids = allVideos.filter(v => v.author === user);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontWeight:900, fontSize:18, color:C.text }}>{isAdmin?"কন্ট্রোল প্যানেল":"প্রোফাইল"}</span>
        <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:C.purpleL, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14} color={C.sub}/></button>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, background:isAdmin?C.goldL:C.purpleL, border:`1px solid ${isAdmin?C.goldM:C.purpleM}`, borderRadius:18, padding:"13px 14px", marginBottom:14 }}>
        <div style={{ width:48, height:48, borderRadius:15, flexShrink:0, background:isAdmin?`linear-gradient(135deg,${C.gold},#FB923C)`:`linear-gradient(135deg,${C.purple},${C.pink})`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isAdmin?`0 6px 18px rgba(245,158,11,.3)`:`0 6px 18px ${C.s2}` }}>
          {isAdmin?<Crown size={22} color="white" strokeWidth={1.5}/>:<User size={22} color="white" strokeWidth={1.5}/>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:17, color:C.text }}>{user}</div>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:4 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:isAdmin?C.goldM:C.purpleM, color:isAdmin?"#92400E":C.purple2, fontSize:11, fontWeight:800, padding:"2px 9px", borderRadius:99 }}>
              {isAdmin?<Crown size={9}/>:<User size={9}/>}{isAdmin?"Super Admin":"Member"}
            </span>
            <span style={{ fontSize:11, color:C.sub, fontWeight:600 }}>{myVids.length}টি ভিডিও</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", gap:8, marginBottom:11 }}>
            {[["users","সদস্য",<Users size={12}/>],["videos","সব ভিডিও",<Video size={12}/>]].map(([k,l,ic])=>(
              <button key={k} onClick={()=>setATab(k)} style={{ display:"flex", alignItems:"center", gap:5, flex:1, padding:"8px 0", borderRadius:12, border:"none", cursor:"pointer", justifyContent:"center", background:aTab===k?`linear-gradient(135deg,${C.purple},${C.pink})`:C.purpleL, color:aTab===k?"#fff":C.purple, fontWeight:800, fontSize:12, fontFamily:"Nunito,sans-serif" }}>{ic}{l}</button>
            ))}
          </div>

          {aTab==="users" && (
            <div style={{ background:"white", borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`, maxHeight:200, overflowY:"auto" }}>
              {allUsers.length===0
                ? <div style={{ padding:16, textAlign:"center", color:C.sub, fontSize:12, fontWeight:600 }}>কোনো সদস্য নেই</div>
                : allUsers.map((u,i)=>(
                <div key={u.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom:i<allUsers.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, background:u.name===ADMIN?`linear-gradient(135deg,${C.gold},#FB923C)`:`linear-gradient(135deg,${C.purple},${C.pink})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {u.name===ADMIN?<Crown size={14} color="white" strokeWidth={2}/>:<User size={14} color="white" strokeWidth={2}/>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:13, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name}</div>
                    <div style={{ fontSize:10, color:C.sub }}>{u.videoCount}টি ভিডিও · {ago(u.joinedAt)}</div>
                  </div>
                  {u.name!==ADMIN && (
                    <button onClick={()=>{onDeleteUser(u.name);showToast(`${u.name} ডিলিট হয়েছে`);}} style={{ width:28, height:28, borderRadius:8, background:"#FEF2F2", border:"1px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                      <Trash2 size={12} color="#EF4444" strokeWidth={2}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {aTab==="videos" && (
            <div style={{ background:"white", borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`, maxHeight:200, overflowY:"auto" }}>
              {allVideos.length===0
                ? <div style={{ padding:16, textAlign:"center", color:C.sub, fontSize:12, fontWeight:600 }}>কোনো ভিডিও নেই</div>
                : allVideos.map((v,i)=>(
                <div key={v.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom:i<allVideos.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:C.purpleL, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Video size={14} color={C.purple} strokeWidth={2}/></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.title}</div>
                    <div style={{ fontSize:10, color:C.sub }}>{v.author} · {v.views} views</div>
                  </div>
                  <button onClick={()=>{onDeleteVideo(v.id);showToast("ভিডিও মুছে ফেলা হয়েছে");}} style={{ width:28, height:28, borderRadius:8, background:"#FEF2F2", border:"1px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                    <Trash2 size={12} color="#EF4444" strokeWidth={2}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background:C.purpleL, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:11, color:C.sub, letterSpacing:.5, marginBottom:10 }}>পারমিশন</div>
        {[
          {icon:<Eye size={13}/>,   label:"ভিডিও দেখা",          ok:true},
          {icon:<Plus size={13}/>,  label:"ভিডিও আপলোড",         ok:true},
          {icon:<Heart size={13}/>, label:"লাইক ও সেভ",           ok:true},
          {icon:<Trash2 size={13}/>,label:"যেকোনো ভিডিও মুছা",   ok:isAdmin},
          {icon:<Shield size={13}/>,label:"সদস্য ম্যানেজ",        ok:isAdmin},
        ].map((p,i,a)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:i<a.length-1?8:0 }}>
            <div style={{ color:C.sub }}>{p.icon}</div>
            <span style={{ flex:1, fontSize:12, fontWeight:600, color:C.text }}>{p.label}</span>
            <CheckCircle size={13} color={p.ok?C.success:C.border} strokeWidth={2.5}/>
          </div>
        ))}
      </div>

      <button onClick={onLogout} style={{ width:"100%", padding:"13px", background:"#FFF5F5", border:"1px solid #FECACA", borderRadius:14, color:"#EF4444", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"Nunito,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        <LogOut size={15} strokeWidth={2}/> লগআউট
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  useEffect(() => { _sec(); }, []);

  const [user,setUser] = useState(null);
  const [videos,setVideos] = useState([]);
  const [likes,setLikes] = useState(new Set());
  const [savedVids,setSavedVids] = useState(new Set());
  const [usersReg,setUsersReg] = useState([]);
  const [tab,setTab] = useState("feed");
  const [search,setSearch] = useState("");
  const [showAdd,setShowAdd] = useState(false);
  const [showProfile,setShowProfile] = useState(false);
  const [showGithub,setShowGithub] = useState(false);
  const [loading,setLoading] = useState(true);
  const [toast,setToast] = useState(null);
  const isAdmin = user === ADMIN;

  /* ── Load user from localStorage (session) ── */
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) setUser(saved);
  }, []);

  /* ── Real-time Firebase listeners ── */
  useEffect(() => {
    // Videos — real-time sync for all users
    const unsub1 = onValue(ref(db, "videos"), snap => {
      const data = snap.val();
      if (data && Object.keys(data).length > 0) {
        setVideos(Object.values(data).map(unpackVid));
      } else {
        // First run — seed initial videos
        SEEDS.forEach(s => fbSetVideo(s));
        setVideos(SEEDS);
      }
      setLoading(false);
    });

    // Users list — real-time sync
    const unsub2 = onValue(ref(db, "users"), snap => {
      const data = snap.val();
      if (data) setUsersReg(Object.values(data));
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  /* ── Per-user likes — real-time sync ── */
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, `userLikes/${user}`), snap => {
      const data = snap.val();
      setLikes(data ? new Set(Object.keys(data)) : new Set());
      // Also restore local backup
      if (data) localStorage.setItem(LIKE_KEY + user, JSON.stringify(Object.keys(data)));
    });
    return () => unsub();
  }, [user]);

  const showToast = useCallback((msg, isGold = false) => {
    setToast({ msg, isGold }); setTimeout(() => setToast(null), 2800);
  }, []);

  const handleLogin = useCallback(async name => {
    setUser(name);
    localStorage.setItem(USER_KEY, name);
    const userObj = { name, joinedAt: Date.now(), videoCount: 0 };
    // Only create if doesn't exist
    onValue(ref(db, `users/${name}`), snap => {
      if (!snap.exists()) fbSetUser(userObj);
    }, { onlyOnce: true });
    showToast(name === ADMIN ? `স্বাগতম, ${name}!` : `স্বাগতম, ${name}!`, name === ADMIN);
  }, [showToast]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null); setShowProfile(false); setLikes(new Set());
  }, []);

  const handleAdd = useCallback(v => {
    fbSetVideo(v);
    // Update user video count
    onValue(ref(db, `users/${v.author}`), snap => {
      const u = snap.val();
      if (u) fbSetUser({ ...u, videoCount: (u.videoCount || 0) + 1 });
    }, { onlyOnce: true });
    setShowAdd(false);
    showToast("ভিডিও পাবলিশ হয়েছে!");
  }, [showToast]);

  const handleLike = useCallback(id => {
    if (!user) return;
    const likeRef = ref(db, `userLikes/${user}/${id}`);
    if (likes.has(id)) {
      // Unlike
      remove(likeRef);
      update(ref(db, `videos/${id}`), { likes: increment(-1) });
    } else {
      // Like
      set(likeRef, true);
      update(ref(db, `videos/${id}`), { likes: increment(1) });
    }
  }, [user, likes]);

  const handleSave = useCallback(id => {
    setSavedVids(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleDeleteVideo = useCallback(id => {
    fbDelVideo(id);
  }, []);

  const handleDeleteUser = useCallback(name => {
    // Delete user's videos from Firebase
    onValue(ref(db, "videos"), snap => {
      const data = snap.val();
      if (data) {
        Object.values(data).filter(v => v.author === name).forEach(v => fbDelVideo(v.id));
      }
    }, { onlyOnce: true });
    fbDelUser(name);
    // Delete user's likes
    remove(ref(db, `userLikes/${name}`));
  }, []);

  const handleImport = useCallback(newVids => {
    newVids.forEach(v => fbSetVideo(v));
    setShowGithub(false);
  }, []);

  const list = videos
    .filter(v => !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.author.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => tab === "trending" ? (b.likes + b.views) - (a.likes + a.views) : b.ts - a.ts);

  if (!user && !loading) return <LoginScreen onLogin={handleLogin}/>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        *{font-family:'Nunito',sans-serif;box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        html,body,#root{width:100%;min-height:100vh;background:${C.bg};overflow-x:hidden;}
        input,textarea{outline:none;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:${C.purpleM};border-radius:99px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes sheetUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{
        background:C.bg,
        minHeight:"100vh", width:"100%",
        paddingBottom:"calc(76px + env(safe-area-inset-bottom,16px))",
        overflowX:"hidden",
      }}>

        {/* ── SOFT HEADER ── */}
        <div style={{
          position:"sticky", top:0, zIndex:100,
          background:"rgba(247,245,255,.92)",
          backdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(229,222,255,.5)",
          padding:"12px 14px 11px",
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:11 }}>
            {/* logo */}
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{
                width:36, height:36, borderRadius:13,
                background:"linear-gradient(145deg,rgba(255,255,255,.9),rgba(240,235,255,.85))",
                backdropFilter:"blur(12px)",
                border:"1px solid rgba(229,222,255,.7)",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 4px 14px rgba(155,127,232,.15), inset 0 1px 0 rgba(255,255,255,.9)",
              }}>
                <div style={{
                  width:22, height:22, borderRadius:7,
                  background:`linear-gradient(145deg,${C.purple},${C.pink})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:`0 3px 8px rgba(155,127,232,.35)`,
                }}>
                  <Video size={12} color="white" strokeWidth={2}/>
                </div>
              </div>
              <span style={{ fontWeight:900, fontSize:19, color:C.text, letterSpacing:-.4 }}>VideoHub</span>
            </div>

            {/* actions */}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setShowAdd(true)} style={{
                display:"flex", alignItems:"center", gap:5,
                background:`linear-gradient(145deg,${C.purple},${C.pink})`,
                border:"none", borderRadius:12, padding:"8px 13px",
                color:"#fff", fontWeight:800, fontSize:12,
                cursor:"pointer", fontFamily:"Nunito,sans-serif",
                boxShadow:`0 4px 16px rgba(155,127,232,.3)`,
                transition:"transform .2s, box-shadow .2s",
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 6px 22px rgba(155,127,232,.4)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 16px rgba(155,127,232,.3)";}}>
                <Plus size={13} strokeWidth={2.5}/>শেয়ার
              </button>

              <button onClick={()=>setShowProfile(true)} style={{
                width:36, height:36, borderRadius:12,
                background:isAdmin
                  ? `linear-gradient(145deg,${C.gold},#FB923C)`
                  : `linear-gradient(145deg,${C.purple},${C.pink})`,
                border:"none",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer",
                boxShadow:isAdmin
                  ? "0 4px 14px rgba(245,166,35,.28)"
                  : "0 4px 14px rgba(155,127,232,.28)",
              }}>
                {isAdmin ? <Crown size={15} color="white" strokeWidth={2}/> : <User size={15} color="white" strokeWidth={2}/>}
              </button>
            </div>
          </div>

          {/* soft search bar */}
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:C.sub }}>
              <Search size={13} strokeWidth={2}/>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="ভিডিও বা নাম খুঁজুন..."
              style={{
                width:"100%", padding:"10px 13px 10px 36px",
                background:"rgba(255,255,255,.8)",
                border:"1.5px solid rgba(229,222,255,.7)",
                borderRadius:14, fontSize:13, color:C.text,
                fontFamily:"Nunito,sans-serif", fontWeight:600,
                backdropFilter:"blur(8px)",
                transition:"border-color .2s, box-shadow .2s",
              }}
              onFocus={e=>{e.target.style.borderColor=C.purple;e.target.style.boxShadow="0 0 0 3px rgba(155,127,232,.1)";}}
              onBlur={e=>{e.target.style.borderColor="rgba(229,222,255,.7)";e.target.style.boxShadow="none";}}
            />
          </div>
        </div>

        {/* ── ADMIN BANNER ── */}
        {isAdmin && (
          <div style={{
            margin:"12px 14px 0",
            background:"linear-gradient(145deg,rgba(255,251,240,.95),rgba(254,242,232,.9))",
            backdropFilter:"blur(12px)",
            borderRadius:20, padding:"11px 14px",
            border:"1px solid rgba(253,236,192,.8)",
            display:"flex", alignItems:"center", gap:11,
            boxShadow:"0 4px 20px rgba(245,166,35,.1)",
          }}>
            <div style={{
              width:36, height:36, borderRadius:12, flexShrink:0,
              background:`linear-gradient(145deg,${C.gold},#FB923C)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 12px rgba(245,166,35,.3)",
            }}><Crown size={16} color="white" strokeWidth={1.8}/></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#92400E" }}>Admin Mode সক্রিয়</div>
              <div style={{ fontSize:11, color:"#B45309", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                সব কন্ট্রোল · ভিডিও ও সদস্য ম্যানেজ
              </div>
            </div>
            <button onClick={()=>setShowGithub(true)} style={{
              display:"flex", alignItems:"center", gap:4,
              background:"rgba(31,41,55,.88)", backdropFilter:"blur(8px)",
              border:"none", borderRadius:11, padding:"7px 11px",
              color:"#fff", fontWeight:800, fontSize:11,
              cursor:"pointer", fontFamily:"Nunito,sans-serif", flexShrink:0,
              boxShadow:"0 3px 10px rgba(0,0,0,.2)",
            }}>
              <Github size={11}/><Zap size={9} color={C.goldM}/>AI
            </button>
          </div>
        )}

        {/* ── SOFT TABS ── */}
        <div style={{ display:"flex", gap:8, padding:"12px 14px 6px" }}>
          {[
            ["feed",    <Home      size={12} strokeWidth={2.5}/>, "ফিড"],
            ["trending",<TrendingUp size={12} strokeWidth={2.5}/>, "ট্রেন্ডিং"],
          ].map(([k,ic,label]) => (
            <button key={k} onClick={()=>setTab(k)} style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"8px 16px", borderRadius:99, border:"none",
              cursor:"pointer", fontFamily:"Nunito,sans-serif",
              fontWeight:800, fontSize:12,
              background: tab===k
                ? `linear-gradient(145deg,${C.purple},${C.pink})`
                : "rgba(255,255,255,.75)",
              color: tab===k ? "#fff" : C.sub,
              backdropFilter:"blur(8px)",
              boxShadow: tab===k
                ? "0 4px 16px rgba(155,127,232,.28)"
                : "0 1px 4px rgba(155,127,232,.08)",
              border: tab===k ? "none" : "1px solid rgba(229,222,255,.7)",
              transition:"all .25s cubic-bezier(.34,1.3,.64,1)",
            }}>{ic}{label}</button>
          ))}
        </div>

        {/* ── VIDEO LIST ── */}
        <div style={{ padding:"8px 14px" }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:70, gap:14 }}>
              <div style={{ position:"relative", width:44, height:44 }}>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:`2px solid ${C.purpleM}`, borderTopColor:C.purple, animation:"spin .8s linear infinite" }}/>
                <div style={{ position:"absolute", inset:6, borderRadius:"50%", border:`1.5px solid ${C.pinkM}`, borderTopColor:C.pink, animation:"spin 1.2s linear infinite reverse" }}/>
              </div>
              <span style={{ fontWeight:600, fontSize:13, color:C.sub }}>লোড হচ্ছে...</span>
            </div>
          ) : list.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 20px", animation:"fadeIn .4s ease" }}>
              <div style={{
                width:76, height:76, borderRadius:26,
                background:"rgba(255,255,255,.8)", backdropFilter:"blur(12px)",
                border:"1.5px solid rgba(229,222,255,.7)",
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 18px",
                boxShadow:"0 8px 32px rgba(155,127,232,.1)",
              }}>
                <Video size={32} color={C.purple} strokeWidth={1.5}/>
              </div>
              <div style={{ fontWeight:900, fontSize:17, color:C.text, marginBottom:6 }}>কোনো ভিডিও নেই</div>
              <div style={{ color:C.sub, fontSize:13, fontWeight:500 }}>প্রথম ভিডিও শেয়ার করুন!</div>
            </div>
          ) : list.map(v => (
            <Card key={v.id} v={v} liked={likes.has(v.id)} onLike={handleLike}
              onDelete={handleDeleteVideo} saved={savedVids.has(v.id)} onSave={handleSave}
              canDelete={isAdmin || v.author === user}
              showToast={showToast}/>
          ))}
        </div>

        {/* ── SOFT BOTTOM NAV ── */}
        <nav style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:100,
          background:"rgba(255,255,255,.92)",
          backdropFilter:"blur(24px)",
          borderTop:"1px solid rgba(229,222,255,.5)",
          display:"flex", justifyContent:"space-around", alignItems:"center",
          paddingTop:10,
          paddingBottom:"calc(14px + env(safe-area-inset-bottom, 8px))",
        }}>
          {[
            { icon:<Home size={20} strokeWidth={1.8}/>, iconA:<Home size={20} strokeWidth={2.5} color={C.purple}/>, label:"ফিড", key:"feed" },
            {
              icon:(
                <div style={{
                  width:52, height:52, borderRadius:"50%",
                  background:`linear-gradient(145deg,${C.purple},${C.pink})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  marginTop:-24,
                  boxShadow:`0 8px 24px rgba(155,127,232,.38)`,
                  border:"3px solid rgba(247,245,255,.9)",
                  transition:"transform .2s",
                }}>
                  <Plus size={22} color="white" strokeWidth={2.5}/>
                </div>
              ),
              label:"শেয়ার", action:()=>setShowAdd(true),
            },
            { icon:<User size={20} strokeWidth={1.8}/>, iconA:<User size={20} strokeWidth={2.5} color={C.purple}/>, label:"প্রোফাইল", action:()=>setShowProfile(true) },
          ].map((item, i) => (
            <button key={i}
              onClick={item.action || (()=>setTab(item.key))}
              style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                background:"none", border:"none", cursor:"pointer",
                fontFamily:"Nunito,sans-serif", fontSize:10, fontWeight:700,
                color: !item.action && tab===item.key ? C.purple : C.sub,
                padding:"0 20px", minWidth:70,
                transition:"color .2s",
              }}>
              {i===1 ? item.icon : (!item.action && tab===item.key ? item.iconA : item.icon)}
              {i !== 1 && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <Sheet open={showAdd} onClose={()=>setShowAdd(false)}>
        <AddForm onDone={handleAdd} onClose={()=>setShowAdd(false)} authorName={user} isAdmin={isAdmin}/>
      </Sheet>

      <Sheet open={showProfile} onClose={()=>setShowProfile(false)}>
        <ProfileSheet user={user} onLogout={handleLogout} onClose={()=>setShowProfile(false)}
          allVideos={videos} allUsers={usersReg}
          onDeleteVideo={handleDeleteVideo} onDeleteUser={handleDeleteUser} showToast={showToast}/>
      </Sheet>

      <Sheet open={showGithub && isAdmin} onClose={()=>setShowGithub(false)}>
        <GitHubPanel onClose={()=>setShowGithub(false)} onImport={handleImport}
          showToast={showToast} existingUrls={new Set(videos.map(v=>v.url))}/>
      </Sheet>

      {/* ── SOFT TOAST ── */}
      {toast && (
        <div style={{
          position:"fixed", bottom:96, left:"50%",
          transform:"translateX(-50%)",
          background: toast.isGold
            ? "linear-gradient(145deg,rgba(255,255,255,.95),rgba(255,251,240,.95))"
            : "rgba(255,255,255,.95)",
          backdropFilter:"blur(20px)",
          color: toast.isGold ? "#92400E" : C.text,
          padding:"11px 20px",
          borderRadius:99,
          fontWeight:800, fontSize:13,
          zIndex:400,
          boxShadow: toast.isGold
            ? "0 8px 32px rgba(245,166,35,.22), 0 1px 0 rgba(255,255,255,.9)"
            : "0 8px 32px rgba(155,127,232,.18), 0 1px 0 rgba(255,255,255,.9)",
          border: toast.isGold
            ? `1px solid ${C.goldM}`
            : `1px solid ${C.purpleM}`,
          animation:"toastIn .28s ease",
          whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <Sparkles size={13} color={toast.isGold ? C.gold : C.purple}/>
          {toast.msg}
        </div>
      )}
    </>
  );
}
