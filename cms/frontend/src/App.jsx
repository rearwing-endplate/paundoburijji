import React, { useState, useEffect, useRef } from 'react';
import { FileText, Save, Plus, Trash2, Image as ImageIcon, X, Upload } from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000/api";

export default function App() {
  const [dispatches, setDispatches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: 'burj',
    bgImage: 'ustreasury.jpg',
    date: new Date().toISOString(),
    description: '',
    content: ''
  });
  const [status, setStatus] = useState('');
  const [availableAssets, setAvailableAssets] = useState([]);
  
  const [modalType, setModalType] = useState(null); // 'plate' or 'body'
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchDispatches();
    fetchAssets();
  }, []);

  const fetchDispatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/dispatches`);
      const data = await res.json();
      setDispatches(data);
    } catch (err) {
      console.error("Backend not reachable", err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_BASE}/assets`);
      const data = await res.json();
      setAvailableAssets(data);
    } catch (err) {
      console.error("Could not fetch assets", err);
    }
  };

  const handleSelect = (art) => {
    setSelectedId(art.id);
    setFormData(art);
    setStatus('');
  };

  const handleNew = () => {
    setSelectedId(null);
    setFormData({
      id: '',
      title: '',
      category: 'burj',
      bgImage: 'yennote.jpg',
      date: new Date().toISOString(),
      description: '',
      content: ''
    });
    setStatus('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('Transmitting to local repository...');
    try {
      const res = await fetch(`${API_BASE}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      setStatus(`Committed: ${result.file}`);
      fetchDispatches();
      if (!selectedId) setSelectedId(result.id);
    } catch (err) {
      setStatus('Transmission failed.');
    }
  };

  const insertImageIntoMarkdown = (imgPath) => {
    const formattedPath = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
    const imgMarkdown = `\n![](${formattedPath})\n`;
    
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = formData.content;
      const updated = text.substring(0, start) + imgMarkdown + text.substring(end);
      setFormData({ ...formData, content: updated });
    } else {
      setFormData({ ...formData, content: formData.content + imgMarkdown });
    }
    setModalType(null);
  };

  const selectPlateAsset = (imgPath) => {
    setFormData({ ...formData, bgImage: imgPath });
    setModalType(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: uploadData
      });
      const data = await res.json();
      if (data.status === 'success') {
        await fetchAssets();
        if (modalType === 'plate') {
          selectPlateAsset(data.asset_path);
        } else {
          insertImageIntoMarkdown(data.asset_path);
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload image.");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0b', color: '#e9e4d9', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }}>
      
      {/* Navigation Wing (Sidebar) */}
      <div style={{ width: '340px', borderRight: '1px solid rgba(124,143,156,0.15)', padding: '32px 24px', overflowY: 'auto', background: 'linear-gradient(180deg, #131316 0%, #0a0a0b 100%)' }}>
        <h1 style={{ fontFamily: 'EB Garamond, serif', fontSize: '22px', fontWeight: '400', letterSpacing: '0.05em', color: '#fff', marginBottom: '32px' }}>
          Temple Incites CMS
        </h1>
        
        <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', background: 'rgba(200,163,94,0.08)', color: '#c8a35e', fontWeight: '600', border: '1px solid rgba(200,163,94,0.3)', borderRadius: '9999px', cursor: 'pointer', marginBottom: '32px', transition: 'all 0.2s ease' }}>
          <Plus size={16} /> Draft New Incite
        </button>

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', color: '#7c8f9c', textTransform: 'uppercase', marginBottom: '16px' }}>Active Ledger</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dispatches.map(item => (
            <div 
              key={item.id} 
              onClick={() => handleSelect(item)} 
              style={{ 
                padding: '16px', borderRadius: '12px', cursor: 'pointer',
                background: selectedId === item.id ? 'rgba(200,163,94,0.08)' : 'rgba(255,255,255,0.02)', 
                border: `1px solid ${selectedId === item.id ? 'rgba(200,163,94,0.4)' : 'rgba(255,255,255,0.05)'}`,
                borderLeft: `3px solid ${item.category === 'salisminster' ? '#c8a35e' : '#7c8f9c'}`,
                transition: 'all 0.2s ease'
              }}>
              <div style={{ fontWeight: '500', fontSize: '14.5px', color: selectedId === item.id ? '#fff' : '#e9e4d9', marginBottom: '6px' }}>{item.title}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#7c8f9c', letterSpacing: '0.05em' }}>{item.category.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Vault (Main Content) */}
      <div style={{ flex: 1, padding: '48px 64px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <FileText size={18} color="#c8a35e" />
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', color: '#c8a35e', textTransform: 'uppercase' }}>
            {selectedId ? 'Protocol: Update' : 'Protocol: Genesis'}
          </div>
        </div>
        
        <h2 style={{ fontFamily: 'EB Garamond, serif', fontSize: '36px', color: '#fff', marginBottom: '40px', fontWeight: '400' }}>
          {selectedId ? formData.title : 'Uncharted Incite'}
        </h2>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '840px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#7c8f9c', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>[ 01 ] TITLE</label>
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '14.5px' }} required />
            </div>
            <div>
              <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#7c8f9c', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>[ 02 ] URL SLUG / ID</label>
              <input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="Auto-generated on save" style={{ width: '100%', padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '14.5px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#7c8f9c', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>[ 03 ] DESK ALLOCATION</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '14px 18px', background: '#131316', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '14.5px', cursor: 'pointer' }}>
                <option value="burj">Burj Al-Jabr (Velocity)</option>
                <option value="salisminster">Salisminster (Bedrock)</option>
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#7c8f9c', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>[ 04 ] VISUAL PLATE</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={formData.bgImage} onChange={e => setFormData({...formData, bgImage: e.target.value})} style={{ flex: 1, padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '14.5px' }} />
                <button type="button" onClick={() => setModalType('plate')} style={{ padding: '0 16px', background: 'rgba(200,163,94,0.1)', border: '1px solid rgba(200,163,94,0.4)', color: '#c8a35e', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Browse Assets">
                  <ImageIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#7c8f9c', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>[ 05 ] META DESCRIPTION</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '14.5px', minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#c8a35e', letterSpacing: '0.05em' }}>[ 06 ] MARKDOWN PAYLOAD</label>
              <button type="button" onClick={() => setModalType('body')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(124,143,156,0.1)', border: '1px solid rgba(124,143,156,0.3)', color: '#7c8f9c', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>
                <ImageIcon size={14} /> Insert Chart / Image into Text
              </button>
            </div>
            <textarea ref={textareaRef} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} style={{ width: '100%', height: '420px', padding: '24px', background: '#050506', border: '1px solid rgba(124,143,156,0.3)', color: '#e9e4d9', fontFamily: 'JetBrains Mono, monospace', fontSize: '13.5px', lineHeight: '1.7', borderRadius: '12px', resize: 'vertical' }} required placeholder="Enter dispatch telemetry here..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 32px', background: '#c8a35e', color: '#0a0a0b', border: 'none', borderRadius: '9999px', fontWeight: '600', letterSpacing: '0.05em', cursor: 'pointer', transition: 'transform 0.15s ease' }}>
                <Save size={18} /> Execute Write
              </button>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: status.includes('failed') ? '#ff4a4a' : '#c8a35e' }}>{status}</span>
            </div>
            
            {selectedId && (
              <button type="button" onClick={() => alert('Delete endpoint requires addition to main.py')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'transparent', color: '#ff4a4a', border: '1px solid rgba(255,74,74,0.3)', borderRadius: '9999px', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>
                <Trash2 size={16} /> Terminate Record
              </button>
            )}
          </div>
        </form>
      </div>

      {/* SCROLLABLE ASSET SELECTOR & UPLOAD VAULT MODAL */}
      {modalType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,11,0.90)', backdropFilter: 'blur(16px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '40px' }}>
          <div style={{ width: '100%', maxWidth: '960px', background: '#131316', border: '1px solid rgba(200,163,94,0.4)', borderRadius: '24px', padding: '36px', display: 'flex', flexDirection: 'column', height: '80vh', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '20px', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#c8a35e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Asset Selector &amp; Ingestion Vault</div>
                <h3 style={{ fontFamily: 'EB Garamond, serif', fontSize: '26px', color: '#fff', fontWeight: '400', marginTop: '4px' }}>
                  {modalType === 'plate' ? 'Select Visual Plate Asset' : 'Select or Upload Chart / Image'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#c8a35e', color: '#0a0a0b', borderRadius: '9999px', fontWeight: '600', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', transition: 'transform 0.15s ease' }}>
                  <Upload size={16} /> Upload New Image
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
                <button onClick={() => setModalType(null)} style={{ background: 'transparent', border: 'none', color: '#e9e4d9', cursor: 'pointer' }}>
                  <X size={26} />
                </button>
              </div>
            </div>

            {/* Scrollable Asset Grid - Fixed 3 columns with clean scrollbar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', overflowY: 'auto', paddingRight: '12px', flex: 1 }}>
              {availableAssets.map((asset, idx) => (
                <div 
                  key={idx} 
                  onClick={() => modalType === 'plate' ? selectPlateAsset(asset) : insertImageIntoMarkdown(asset)}
                  style={{ 
                    background: '#0a0a0b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s ease',
                    display: 'flex', flexDirection: 'column', height: '230px'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8a35e'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0px)'; }}
                >
                  <div style={{ flex: 1, background: '#050506', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                    <img src={`http://127.0.0.1:8000/${asset}`} alt={asset} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ padding: '12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#e9e4d9', wordBreak: 'break-all', textAlign: 'center', background: '#131316', flexShrink: 0 }}>
                    {asset.split('/').pop()}
                  </div>
                </div>
              ))}
              {availableAssets.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#7c8f9c', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                  No assets detected. Click <strong>Upload New Image</strong> to ingest charts or plates directly.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}