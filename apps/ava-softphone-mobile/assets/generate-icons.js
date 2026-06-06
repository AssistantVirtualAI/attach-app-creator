/* eslint-disable */
// Generate Lemtel Telecom app icon (1024x1024) and splash (2732x2732).
// Usage: cd apps/ava-softphone-mobile && npm i -D canvas && node assets/generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname);

// ---------- ICON 1024x1024 ----------
const iconCanvas = createCanvas(1024, 1024);
const iconCtx = iconCanvas.getContext('2d');

const grad = iconCtx.createLinearGradient(0, 0, 1024, 1024);
grad.addColorStop(0, '#050816');
grad.addColorStop(1, '#0a1030');
iconCtx.fillStyle = grad;
if (typeof iconCtx.roundRect === 'function') {
  iconCtx.beginPath();
  iconCtx.roundRect(0, 0, 1024, 1024, 180);
  iconCtx.fill();
} else {
  iconCtx.fillRect(0, 0, 1024, 1024);
}

// Gold outer ring
iconCtx.strokeStyle = '#FFD700';
iconCtx.lineWidth = 24;
iconCtx.beginPath();
iconCtx.ellipse(512, 420, 340, 165, 0, 0, Math.PI * 2);
iconCtx.stroke();

// Blue inner oval
iconCtx.fillStyle = '#003DA6';
iconCtx.beginPath();
iconCtx.ellipse(512, 420, 310, 140, 0, 0, Math.PI * 2);
iconCtx.fill();

// LEMTEL text
iconCtx.fillStyle = 'white';
iconCtx.font = 'bold 110px Arial';
iconCtx.textAlign = 'center';
iconCtx.fillText('LEMTEL', 512, 395);

// TELECOM text
iconCtx.font = '52px Arial';
iconCtx.fillText('TELECOM', 512, 460);

// AI tagline
iconCtx.fillStyle = '#FFD700';
iconCtx.font = '38px Arial';
iconCtx.fillText('AI Phone', 512, 620);

// AVA dot
iconCtx.beginPath();
iconCtx.arc(512, 700, 30, 0, Math.PI * 2);
iconCtx.fillStyle = '#7C3AED';
iconCtx.fill();
iconCtx.fillStyle = 'white';
iconCtx.font = 'bold 22px Arial';
iconCtx.fillText('AVA', 512, 708);

fs.writeFileSync(path.join(OUT, 'icon.png'), iconCanvas.toBuffer('image/png'));
console.log('✅ Icon generated → assets/icon.png');

// ---------- SPLASH 2732x2732 ----------
const splashCanvas = createCanvas(2732, 2732);
const splashCtx = splashCanvas.getContext('2d');

const splashGrad = splashCtx.createRadialGradient(1366, 1366, 0, 1366, 1366, 1366);
splashGrad.addColorStop(0, '#0a1030');
splashGrad.addColorStop(1, '#050816');
splashCtx.fillStyle = splashGrad;
splashCtx.fillRect(0, 0, 2732, 2732);

// Lemtel logo centered
splashCtx.strokeStyle = '#FFD700';
splashCtx.lineWidth = 28;
splashCtx.beginPath();
splashCtx.ellipse(1366, 1200, 500, 230, 0, 0, Math.PI * 2);
splashCtx.stroke();

splashCtx.fillStyle = '#003DA6';
splashCtx.beginPath();
splashCtx.ellipse(1366, 1200, 462, 200, 0, 0, Math.PI * 2);
splashCtx.fill();

splashCtx.fillStyle = 'white';
splashCtx.font = 'bold 160px Arial';
splashCtx.textAlign = 'center';
splashCtx.fillText('LEMTEL', 1366, 1165);

splashCtx.font = '72px Arial';
splashCtx.fillText('COMMUNICATIONS', 1366, 1265);

splashCtx.fillStyle = 'white';
splashCtx.font = '80px Arial';
splashCtx.fillText('Lemtel Telecom', 1366, 1500);

splashCtx.fillStyle = '#FFD700';
splashCtx.font = '52px Arial';
splashCtx.fillText('AI-Powered Business Communications', 1366, 1580);

fs.writeFileSync(path.join(OUT, 'splash.png'), splashCanvas.toBuffer('image/png'));
console.log('✅ Splash generated → assets/splash.png');
