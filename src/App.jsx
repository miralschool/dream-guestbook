import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import * as XLSX from 'xlsx';

export default function DreamGuestbook() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ name: '', message: '' });
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const workbookRef = useRef(XLSX.utils.book_new());

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      addEntry(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleTakePhoto = async () => {
    const countdown = document.createElement('div');
    countdown.style.position = 'fixed';
    countdown.style.top = '50%';
    countdown.style.left = '50%';
    countdown.style.transform = 'translate(-50%, -50%)';
    countdown.style.fontSize = '72px';
    countdown.style.fontWeight = 'bold';
    countdown.style.zIndex = '1000';
    countdown.style.color = '#333';
    document.body.appendChild(countdown);

    const delay = (n) => new Promise((r) => setTimeout(r, 1000));
    for (const n of [3, 2, 1]) {
      countdown.textContent = n;
      await delay();
    }
    document.body.removeChild(countdown);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('카메라 접근이 지원되지 않는 브라우저입니다.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (err) {
      alert(`카메라 접근 실패: ${err.message}`);
      return;
    }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      addEntry(dataUrl);
      stream.getTracks().forEach((track) => track.stop());
    };
  };

  const calculatePositions = (direction) => {
    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
    const fromX = direction === -1 ? containerWidth + 200 : -200;
    const toX = direction === -1 ? -200 : containerWidth + 200;
    return { fromX, toX };
  };

  const addEntry = (imgSrc) => {
    const name = form.name.trim() || '드림대학';
    const message = form.message.trim() || '너희 꿈을 응원해';

    fetch("https://api.sheetbest.com/sheets/130b0844-e47d-4057-99d8-0500fd0fca56", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, timestamp: new Date().toLocaleString('ko-KR') })
    });

    const direction = Math.random() < 0.5 ? -1 : 1;
    const speed = Math.random() * 10 + 20;
    const { fromX, toX } = calculatePositions(direction);

    const newEntry = {
      id: Date.now(),
      name,
      message,
      image: imgSrc,
      y: Math.random() * (window.innerHeight - 240),
      fromX,
      toX,
      speed,
      direction
    };

    setEntries((prev) => [...prev.slice(-19), newEntry]);
    setForm({ name: '', message: '' });
  };

  useEffect(() => {
    const handleResize = () => {
      setEntries((prev) =>
        prev.map((entry) => {
          const { fromX, toX } = calculatePositions(entry.direction);
          return { ...entry, fromX, toX };
        })
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const data = entries.map(({ name, message }) => ({ 이름: name, 한마디: message }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const wb = workbookRef.current;
    wb.SheetNames = [];
    wb.Sheets = {};
    XLSX.utils.book_append_sheet(wb, worksheet, '방명록');
  }, [entries]);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-sky-50 overflow-hidden">
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg w-[320px] gap-2">
        <img src="/milal-logo.png" alt="로고" className="h-10 mb-2 object-contain" />
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleInputChange}
          placeholder="이름 (선택)"
          maxLength={10}
          className="border border-gray-300 p-3 rounded-xl w-full text-sm"
        />
        <input
          type="text"
          name="message"
          value={form.message}
          onChange={handleInputChange}
          placeholder="한마디 (선택)"
          maxLength={20}
          className="border border-gray-300 p-3 rounded-xl w-full text-sm"
        />
        <div className="flex gap-3 mt-2 w-full justify-center">
          <button
            onClick={() => fileInputRef.current.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl shadow"
          >
            사진 업로드
          </button>
          <button
            onClick={handleTakePhoto}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl shadow"
          >
            사진 촬영
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            hidden
          />
        </div>
      </div>

      {entries.map((entry) => (
        <FloatingEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function FloatingEntry({ entry }) {
  const controls = useAnimation();
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const isMounted = useRef(true);

  const animateLoop = async () => {
    if (running || !isMounted.current) return;
    setRunning(true);
    while (isMounted.current) {
      if (paused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      await controls.start({
        x: entry.toX,
        opacity: 1,
        rotate: 0,
        scale: 1,
        transition: { duration: entry.speed, ease: 'linear' },
      });
      if (!isMounted.current || paused) break;
      await controls.set({ x: entry.fromX });
    }
  };

  useEffect(() => {
    isMounted.current = true;
    controls.set({ x: entry.fromX });
    animateLoop();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClick = async () => {
    if (paused || running) return;
    setPaused(true);
    await controls.stop();
    await controls.start({ scale: 2, transition: { duration: 0.3 } });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await controls.start({ scale: 1 });
    setPaused(false);
    animateLoop();
  };

  const handleDragStart = async () => {
    await controls.stop();
  };

  const handleDragEnd = () => {
    animateLoop();
  };

  return (
    <motion.div
      drag
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      animate={controls}
      onClick={handleClick}
      className="absolute w-[224px] h-[336px] gap-2 bg-yellow-100 rounded-2xl shadow cursor-move"
      style={{ top: entry.y }}
    >
      <img
        src={entry.image}
        alt="방문자 사진"
        className="w-[196px] h-[252px] object-contain mx-auto mb-1"
      />
      <div className="text-center text-lg font-bold truncate mt-2">{entry.name}</div>
      <div className="text-center text-sm truncate mt-1">{entry.message}</div>
    </motion.div>
  );
}
