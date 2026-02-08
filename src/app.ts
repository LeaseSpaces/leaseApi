import express, { Application } from "express";
import cors from "cors";
import Routes from "./routes";

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Techy landing page with animations
app.get("/", (_req, res) => {
  res.type("html").status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeaseSpaces API</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      overflow: hidden;
      font-family: 'Orbitron', 'Rajdhani', monospace;
      background: #0a0e17;
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    /* Animated grid background */
    .grid-bg {
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      animation: gridMove 20s linear infinite;
      pointer-events: none;
    }
    @keyframes gridMove {
      0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
      100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
    }
    /* Radial glow */
    .glow {
      position: fixed;
      width: 150%;
      height: 150%;
      top: -25%;
      left: -25%;
      background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 40, 60, 0.4) 50%, transparent 70%);
      animation: pulse 8s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    /* Scan line overlay */
    .scanline {
      position: fixed;
      inset: 0;
      background: linear-gradient(transparent 50%, rgba(0, 0, 0, 0.1) 50%);
      background-size: 100% 4px;
      pointer-events: none;
      animation: scan 0.1s linear infinite;
    }
    @keyframes scan {
      0% { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    .content {
      position: relative;
      z-index: 2;
      text-align: center;
      padding: 2rem;
    }
    .title-wrap {
      position: relative;
      display: inline-block;
    }
    .title {
      font-size: clamp(2rem, 6vw, 4rem);
      font-weight: 900;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      background: linear-gradient(90deg, #00ffff, #00ff88, #00ffff);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 3s linear infinite, float 4s ease-in-out infinite;
    }
    .title-glitch {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      font-size: clamp(2rem, 6vw, 4rem);
      font-weight: 900;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      background: linear-gradient(90deg, #00ffff, #00ff88, #00ffff);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      opacity: 0;
      animation: glitch 4s infinite;
      clip-path: inset(0 0 0 0);
    }
    .title-glitch::before,
    .title-glitch::after {
      content: attr(data-text);
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
    }
    .title-glitch::before {
      animation: glitchTop 0.5s infinite;
      clip-path: polygon(0 0, 100% 0, 100% 33%, 0 33%);
      text-shadow: 2px 0 #ff00ff;
      -webkit-text-fill-color: transparent;
      background: linear-gradient(90deg, #ff00ff, #00ffff);
      -webkit-background-clip: text;
      background-clip: text;
    }
    .title-glitch::after {
      animation: glitchBottom 0.5s infinite;
      clip-path: polygon(0 67%, 100% 67%, 100% 100%, 0 100%);
      text-shadow: -2px 0 #00ff88;
      -webkit-text-fill-color: transparent;
      background: linear-gradient(90deg, #00ff88, #ff00ff);
      -webkit-background-clip: text;
      background-clip: text;
    }
    @keyframes glitchTop {
      0% { transform: translate(0); }
      20% { transform: translate(-3px, 3px); }
      40% { transform: translate(3px, -3px); }
      60% { transform: translate(-3px, -3px); }
      80% { transform: translate(3px, 3px); }
      100% { transform: translate(0); }
    }
    @keyframes glitchBottom {
      0% { transform: translate(0); }
      20% { transform: translate(3px, -3px); }
      40% { transform: translate(-3px, 3px); }
      60% { transform: translate(3px, 3px); }
      80% { transform: translate(-3px, -3px); }
      100% { transform: translate(0); }
    }
    @keyframes glitch {
      0%, 90%, 100% { opacity: 0; }
      92% { opacity: 0.8; }
      94% { opacity: 0; }
      96% { opacity: 0.9; }
      98% { opacity: 0; }
    }
    @keyframes shimmer {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .subtitle {
      font-family: 'Rajdhani', sans-serif;
      font-size: clamp(1rem, 2.5vw, 1.4rem);
      font-weight: 300;
      letter-spacing: 0.5em;
      margin-top: 1.5rem;
      color: rgba(0, 255, 255, 0.7);
      animation: fadeIn 1.5s ease-out 0.5s both, blink 2s ease-in-out 2s infinite;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes blink {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .api-badge {
      display: inline-block;
      margin-top: 2.5rem;
      padding: 0.6rem 1.5rem;
      font-size: 0.75rem;
      letter-spacing: 0.3em;
      border: 1px solid rgba(0, 255, 255, 0.4);
      background: rgba(0, 255, 255, 0.05);
      color: #00ffff;
      animation: borderPulse 2s ease-in-out infinite, fadeIn 1s ease-out 1s both;
    }
    @keyframes borderPulse {
      0%, 100% { box-shadow: 0 0 5px rgba(0, 255, 255, 0.2); }
      50% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.4); }
    }
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.4;
      pointer-events: none;
    }
    .orb-1 {
      width: 300px;
      height: 300px;
      background: #00ffff;
      top: 10%;
      left: 10%;
      animation: orbFloat 15s ease-in-out infinite;
    }
    .orb-2 {
      width: 200px;
      height: 200px;
      background: #00ff88;
      bottom: 20%;
      right: 15%;
      animation: orbFloat 12s ease-in-out infinite reverse;
    }
    .orb-3 {
      width: 150px;
      height: 150px;
      background: #ff00ff;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: orbFloat 10s ease-in-out infinite 1s;
    }
    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(30px, -30px); }
      50% { transform: translate(-20px, 20px); }
      75% { transform: translate(20px, 20px); }
    }
    .orb-2 { animation-name: orbFloatReverse; }
    @keyframes orbFloatReverse {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-30px, 30px); }
      50% { transform: translate(20px, -20px); }
      75% { transform: translate(-20px, -20px); }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="scanline"></div>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="content">
    <div class="title-wrap">
      <h1 class="title" data-text="Hello from South Africa">Hello from South Africa</h1>
      <h1 class="title-glitch" data-text="Hello from South Africa" aria-hidden="true">Hello from South Africa</h1>
    </div>
    <p class="subtitle">LeaseSpaces API · Live</p>
    <span class="api-badge">localhost:8080</span>
  </div>
</body>
</html>
  `);
});

app.get("/hello", (_req, res) => {
  res.status(200).send("new route");
});

app.get("/test", (_req, res) => {
  res.status(200).send("testing route");
});

// system routes routes
app.use("/api/", Routes);


export { app };
