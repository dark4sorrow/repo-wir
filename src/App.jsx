import React, { useState, useEffect, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { 
  Layout, 
  Zap, 
  FileText, 
  FileType, 
  Trash2, 
  Camera, 
  RefreshCw, 
  Eye, 
  Archive, 
  ShieldCheck, 
  HardDrive, 
  Phone, 
  Ticket, 
  ExternalLink, 
  Activity, 
  Info, 
  PlayCircle, 
  X, 
  Mail, 
  Terminal, 
  Copy, 
  GraduationCap, 
  ShieldAlert, 
  Fingerprint, 
  Save, 
  FolderOpen, 
  Download, 
  Edit3, 
  Check, 
  FileJson, 
  MessageSquare, 
  List
} from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';
ChartJS.register(...registerables);

function App() {
  const [viewMode, setViewMode] = useState('builder'); 
  const [reportData, setReportData] = useState(() => {
    const saved = localStorage.getItem('wir_working_draft');
    return saved ? JSON.parse(saved) : {};
  });
  const [loading, setLoading] = useState({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showArchives, setShowArchives] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [archiveList, setArchiveList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isEditingDate, setIsEditingDate] = useState(false);
  
  // FIX: Track if user is currently typing to prevent "Jumping UI" scrolling
  const [isTyping, setIsEditingFocus] = useState(false);
  
  const logEndRef = useRef(null);
  const isInternalUpdate = useRef(false);
  
  // FIX: Dedicated ref anchor maps directly to the inner scroll container to manage tracking dimensions accurately
  const scrollContainerRef = useRef(null);

  // --- COLLABORATION SYNC LOGIC ---
  const loadDraftFromServer = async () => {
    if (isInternalUpdate.current || isTyping) return;

    try {
      const res = await fetch('/api/draft');
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        setReportData(data);
        localStorage.setItem('wir_working_draft', JSON.stringify(data));
      }
    } catch (e) { 
        addLog("!!! [SYNC] Server pull failed."); 
    }
  };

  const saveDraftToServer = async (dataToSave, isManual = false) => {
    isInternalUpdate.current = true;
    let finalPayload = dataToSave || reportData;

    if (!finalPayload.report_week) {
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        finalPayload = { ...finalPayload, report_week: today };
    }

    if (isManual) {
        addLog(">>> [ATOMIC] Merging with server state to prevent data loss...");
        try {
            const res = await fetch('/api/draft');
            const serverData = await res.json();
            finalPayload = { ...serverData, ...finalPayload };
        } catch (e) { 
            addLog("!! [WARN] Atomic merge failed, using local state."); 
        }
    }

    const payloadString = JSON.stringify(finalPayload);
    localStorage.setItem('wir_working_draft', payloadString);
    setReportData(finalPayload);

    try {
      const totalBytes = payloadString.length;
      const totalKB = (totalBytes / 1024).toFixed(1);
      
      let imageCount = 0;
      Object.keys(finalPayload).forEach(key => {
        if (finalPayload[key]?.images) {
          imageCount += finalPayload[key].images.length;
        }
      });

      addLog(`>>> [PAYLOAD METRICS] Captured Assets: ${imageCount} items | Unified Size: ${totalKB} KB tracking storage footprint.`);

      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      });
      const result = await res.json();
      if (res.ok && isManual) {
          addLog(`>>> [SUCCESS] Manual Atomic Sync complete. Draft saved to: ${result.filename}`);
      }
    } catch (e) { 
        addLog("!!! [SYNC] Server save failed."); 
    }
    
    setTimeout(() => { isInternalUpdate.current = false; }, 2000);
  };

  useEffect(() => {
    loadDraftFromServer();
    const interval = setInterval(loadDraftFromServer, 30000); 
    return () => clearInterval(interval);
  }, [isTyping]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (Object.keys(reportData).length > 0) {
        e.preventDefault(); e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [reportData]);

  const WIDGETS = [
    { 
      id: 'network', 
      title: 'NETWORK (WUG/ISP UPLINKS)', 
      icon: <Zap size={18} className="text-yellow-400"/>, 
      dash: 'https://galacticbacon.nic.edu/wug-dash/',
      appUrl: 'https://monitor.nic.edu/NmConsole/#v=Wug_view_dashboard_Home/p=%7B%22viewId%22%3A763%7D',
      blurb: 'Availability of campus core distribution and ISP uplinks (Iron, Ziply, Fatbeam).' 
    },
    { 
      id: 'palo', 
      title: 'PALO ALTO (NGFW TRAFFIC)', 
      icon: <ShieldAlert size={18} className="text-red-500"/>, 
      dash: 'https://galacticbacon.nic.edu/palo-commander/',
      appUrl: 'https://10.11.0.121/',
      blurb: 'Next-Gen Firewall throughput, active threat prevention events, and GlobalProtect VPN utilization.' 
    },
    { 
      id: 'meraki', 
      title: 'MERAKI (SD-WAN & WIRELESS)', 
      icon: <Activity size={18} className="text-cyan-400"/>, 
      dash: 'https://galacticbacon.nic.edu/meraki-dash/',
      appUrl: 'https://n1.dashboard.meraki.com/login/dashboard_login/nic?eid=DmuOHa&sso=true',
      blurb: 'SD-WAN performance, loss/latency history, and cloud-managed infrastructure health.' 
    },
    { 
      id: 'duo', 
      title: 'DUO SECURITY (MFA & TRUST)', 
      icon: <Fingerprint size={18} className="text-green-500"/>, 
      dash: 'https://galacticbacon.nic.edu/duo-dashboard/',
      appUrl: 'https://admin.duosecurity.com/login?next=%2F',
      blurb: 'Identity assurance metrics: unique enrollment, authentication success, and fraud prevention.' 
    },
    { 
      id: 'tenable', 
      title: 'TENABLE (VULN MANAGEMENT)', 
      icon: <Activity size={18} className="text-orange-600"/>, 
      dash: 'https://galacticbacon.nic.edu/tenable/',
      appUrl: 'https://secten.nic.edu/',
      blurb: 'Risk exposure tracking: Critical vulnerabilities, remediation velocity, and asset debt trends.' 
    },
    { 
      id: 'varonis', 
      title: 'VARONIS (DATA & GLBA)', 
      icon: <ShieldCheck size={18} className="text-blue-500"/>, 
      dash: 'https://galacticbacon.nic.edu/varonis-dash/',
      appUrl: 'https://nic.varonis.io',
      blurb: 'NIST-aligned governance: FTI/GLBA data exposure, active threat detections, and case velocity.' 
    },
    { 
      id: 'kb4', 
      title: 'KNOWBE4 (AWARENESS)', 
      icon: <GraduationCap size={18} className="text-amber-400"/>, 
      dash: 'https://galacticbacon.nic.edu/knowbe4-dash/',
      appUrl: 'https://training.knowbe4.com/app/login',
      blurb: 'Human firewall metrics: Phish-prone percentages, training completion, and 30-day engagement.' 
    },
    { 
      id: 'workstations', 
      title: 'EDR (SENTINELONE)', 
      icon: <ShieldCheck size={18} className="text-emerald-400"/>, 
      dash: 'https://galacticbacon.nic.edu/s1-dashboard/',
      appUrl: 'https://usea1-016.sentinelone.net/dashboard',
      blurb: 'Endpoint security: Agent health, active threats, and fleet-wide OS risk assessment.' 
    },
    { 
      id: 'servers', 
      title: 'SERVERS & VMS (GOVC)', 
      icon: <Layout size={18} className="text-blue-400"/>, 
      dash: 'https://galacticbacon.nic.edu/vm-gap-dashboard/',
      appUrl: 'https://galacticbacon.nic.edu/vm-govc/',
      blurb: 'Virtual infrastructure inventory, power states, and legacy OS mitigation tracking.' 
    },
    { 
      id: 'storage', 
      title: 'SOURCE-OF-TRUTH AUDIT', 
      icon: <HardDrive size={18} className="text-orange-400"/>, 
      dash: 'https://galacticbacon.nic.edu/hostmonitor/',
      blurb: 'Asset integrity: Comparing known infrastructure against live EDR discovery counts.' 
    },
    { 
      id: 'email', 
      title: 'EMAIL & ENTRA ID', 
      icon: <Mail size={18} className="text-purple-400"/>, 
      dash: 'https://galacticbacon.nic.edu/exchange/',
      appUrl: 'https://entra.microsoft.com/',
      blurb: 'M365 health: Risky sign-ins, global admin audits, and mail security profiles.' 
    },
    { 
      id: 'backups', 
      title: 'BACKUPS (VEEAM)', 
      icon: <Activity size={18} className="text-green-400"/>, 
      dash: 'https://galacticbacon.nic.edu/veeam/',
      appUrl: 'https://veeamone.nic.edu/',
      blurb: 'Verification of job completion, restore point counts, and repository availability.' 
    },
    { 
      id: 'tickets', 
      title: 'TEAMDYNAMIX (TDX)', 
      icon: <Ticket size={18} className="text-rose-400"/>, 
      dash: 'https://galacticbacon.nic.edu/teamdynamix/',
      appUrl: 'https://nic.teamdynamix.com',
      blurb: 'Help Desk throughput and service level metrics for active responsibility groups.' 
    }
  ];

  const addLog = (msg) => { setLogs(prev => [...prev.slice(-100), msg]); };
  
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [logs]);

  const copyLogs = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText);
    addLog(">>> [SYSTEM] Terminal contents copied to clipboard.");
  };

  const fetchMetrics = async (id) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/metrics/${id === 'email' ? 'exchange' : id}`);
      const result = await res.json();
      
      setReportData(prev => {
        const updated = { ...prev, [id]: { ...prev[id], metrics: result } };
        saveDraftToServer(updated); 
        return updated;
      });
      
      addLog(`<<< [SUCCESS] ${id.toUpperCase()} Updated.`);
    } catch (e) { addLog(`!!! [FAILURE] ${id}: ${e.message}`); }
    setLoading(prev => ({ ...prev, [id]: false }));
  };

  const pollAllWidgets = async () => {
    setIsSyncingAll(true);
    isInternalUpdate.current = true;
    await fetch('/api/log-action', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ action: 'POLL_ALL', details: 'Team-wide full metrics refresh triggered' })
    });
    for (const w of WIDGETS) { await fetchMetrics(w.id); }
    setIsSyncingAll(false);
    setTimeout(() => { isInternalUpdate.current = false; }, 5000); 
  };

  const openAuditLogs = async () => {
    const res = await fetch('/api/audit-logs');
    setAuditLogs(await res.json());
    setShowAudit(true);
  };

  const openArchiveVault = async () => {
    try {
      const res = await fetch('/api/archives');
      setArchiveList(await res.json());
      setShowArchives(true);
    } catch (e) { addLog("!!! [VAULT] Error loading archives."); }
  };

  const archiveCurrentReport = async () => {
    if (!window.confirm("Archive the current report? This clears the board.")) return;
    try {
      const res = await fetch('/api/archive-current', { method: 'POST' });
      const result = await res.json();
      setReportData({});
      localStorage.removeItem('wir_working_draft');
      addLog(`>>> [ARCHIVE] Finalized: ${result.filename}`);
    } catch (e) { addLog("!!! [ARCHIVE FAIL] Could not finalize."); }
  };

  const renameFile = async (oldName) => {
    const newName = window.prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;
    await fetch('/api/rename-archive', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ oldName, newName })
    });
    openArchiveVault();
  };

  const restoreArchive = async (filename) => {
    if (!window.confirm("Restore this archive? Active draft will be overwritten.")) return;
    await fetch('/api/load-archive', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ filename })});
    setShowArchives(false);
    loadDraftFromServer();
  };

  const deleteArchive = async (filename) => {
    if (!window.confirm("Delete permanently?")) return;
    await fetch(`/api/archive/${filename}`, { method: 'DELETE' });
    openArchiveVault();
  };

  const handleImageUpload = (id, file) => {
    isInternalUpdate.current = true;
    
    // FIX: Read the exact internal scrollTop attribute from our custom layout element reference anchor tag
    const currentScrollTop = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1280;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          if (!blob) { isInternalUpdate.current = false; return; }

          const formData = new FormData();
          formData.append('image', blob, `wir_upload_${Date.now()}.jpg`);

          try {
            const uploadRes = await fetch('/api/upload-image', {
              method: 'POST',
              body: formData
            });
            
            if (!uploadRes.ok) {
              addLog("!!! [UPLOAD] Enterprise gateway blocked the asset file size transaction.");
              isInternalUpdate.current = false;
              return;
            }

            const uploadResult = await uploadRes.json();
            const serverImageRoutePath = uploadResult.url;

            setReportData(prev => {
              const updated = { ...prev, [id]: { ...prev[id], images: [...(prev[id]?.images || []), serverImageRoutePath] } };
              saveDraftToServer(updated);
              return updated;
            });

            // FIX: Restore position directly back inside the true container box view timeline
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = currentScrollTop;
            }

          } catch (err) {
            addLog(`!!! [UPLOAD FAILED] Network exception: ${err.message}`);
          } finally {
            setTimeout(() => { 
              isInternalUpdate.current = false; 
              // Safety pass locks scroll orientation against DOM lagging shifts completely
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = currentScrollTop;
              }
            }, 100);
          }
        }, 'image/jpeg', 0.65);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id, idx) => {
    setReportData(prev => {
      const updated = { ...prev, [id]: { ...prev[id], images: prev[id].images.filter((_, i) => i !== idx) } };
      saveDraftToServer(updated);
      return updated;
    });
  };

  const removeWidget = (id) => {
    setReportData(prev => {
      const updated = { ...prev };
      delete updated[id];
      saveDraftToServer(updated);
      return updated;
    });
  };

  const updateNote = (id, val) => {
    setReportData(prev => {
      const updated = { ...prev, [id]: { ...prev[id], note: val } };
      saveDraftToServer(updated);
      return updated;
    });
  };

  const getExecutiveBoxes = (id, m) => {
    if (!m) return [{l: 'AWAITING DATA', v: '0'}];
    if (m.error) return [{l: 'COLLECTOR ERROR', v: 'ERR'}];
    const s = m.summary || {};
    const r = m.risk_factors || {};

    switch(id) {
      case 'network': 
        return [
          {l:'UP DEVICES', v: m.up_devices ?? 0}, 
          {l:'DOWN', v: m.down_devices ?? 0}, 
          {l:'LINKS', v: m.active_links ?? 4}, 
          {l:'MTTR AVG', v: m.mttr_trends?.length ? m.mttr_trends[m.mttr_trends.length-1] : '6.0'}
        ];
      case 'palo': 
        return [
          {l:'SESSIONS', v: s.active_sessions ?? 0}, 
          {l:'THROUGHPUT', v: s.throughput_mbps ? `${s.throughput_mbps} Mb` : '0 Mb'}, 
          {l:'VPN USERS', v: s.vpn_users ?? 0}, 
          {l:'THREAT DROPS', v: s.threat_events ?? 0}, 
          {l:'LOG DISK', v: s.log_disk ?? '0%'}, 
          {l:'HA STATE', v: s.ha_status ?? 'N/A'}
        ];
      case 'meraki': 
        return [
          {l:'ONLINE', v: s.online_devices ?? 0}, 
          {l:'ALERTING', v: s.alerting_devices ?? 0}, 
          {l:'OFFLINE', v: s.offline_devices ?? 0}, 
          {l:'NETWORKS', v: s.network_count ?? 0}, 
          {l:'WAN LATENCY', v: s.avg_latency ?? '0ms'}, 
          {l:'TOTAL TRAFFIC', v: s.total_throughput ?? '0GB'}
        ];
      case 'duo': 
        return [
          {l:'HEADCOUNT', v: s.total_users ?? 0}, 
          {l:'SUCCESS %', v: s.auth_success_rate ?? '0%'}, 
          {l:'DENIED/FAIL', v: s.denied_count ?? 0}, 
          {l:'BYPASS', v: s.bypass_count ?? 0}, 
          {l:'PUSH RATIO', v: s.push_percentage ?? '0%'}, 
          {l:'FRAUD ALERTS', v: s.fraud_alerts ?? 0}
        ];
      case 'tenable': 
        return [
          {l:'CRITICAL VULNS', v: s.critical ?? 0}, 
          {l:'HIGH VULNS', v: s.high ?? 0}, 
          {l:'MEDIUM VULNS', v: s.medium ?? 0}, 
          {l:'RISKY ASSETS', v: s.risky_assets ?? 0}, 
          {l:'REMEDIATION %', v: s.remediation_rate ?? '0%'}, 
          {l:'WEEKLY DRIFT', v: s.vuln_drift ?? '0'}
        ];
      case 'varonis': 
        return [
          {l:'THREAT DETECT', v: s.high_alerts ?? 0}, 
          {l:'GLBA EXPOSURE', v: s.exposed_files ?? 0}, 
          {l:'FEDERAL TAX', v: s.fti_risks ?? 0}, 
          {l:'COLLEAGUE IDs', v: s.cid_risks ?? 0}, 
          {l:'RESOLVED', v: s.resolved_cases ?? 0}, 
          {l:'VELOCITY', v: s.closure_velocity ?? '0%'}
        ];
      case 'kb4': 
        return [
          {l:'PHISH PRONE %', v: s.phish_prone_pct ?? '0%'}, 
          {l:'AVG RISK', v: s.avg_risk_score ?? 0}, 
          {l:'HIGH RISK', v: s.high_risk_users ?? 0}, 
          {l:'ACTIVE SEATS', v: s.active_seats ?? 0}, 
          {l:'ENGAGEMENT', v: s.engagement_rate ?? '0%'}, 
          {l:'UNMANAGED', v: s.unmanaged_users ?? 0}
        ];
      case 'tickets': 
        return [
          {l:'24H RESOLVED', v: s.closed_24h ?? 0}, 
          {l:'7D THROUGHPUT', v: s.throughput_weekly ?? 0}, 
          {l:'30D VOLUME', v: s.throughput_monthly ?? 0}, 
          {l:'VELOCITY', v: s.active_efficiency ?? '0/hr'}
        ];
      case 'workstations': 
        return [
          {l:'TOTAL AGENTS', v: s.total_endpoints ?? 0}, 
          {l:'COMPLIANCE RATE', v: s.compliance_rate ?? '0%'}, 
          {l:'7D THREATS', v: s.active_threats_7d ?? 0}, 
          {l:'WINDOWS FLEET', v: m.fleet?.windows ?? 0}
        ];
      case 'servers': 
        return [
          {l:'VCENTER VMS', v: s.total ?? 0}, 
          {l:'POWERED ON', v: s.powered_on ?? 0}, 
          {l:'LEGACY OS', v: r.legacy_os_count ?? 0}, 
          {l:'UPTIME SCORE', v: s.integrity_score ?? '0%'}
        ];
      case 'storage': 
        return [
          {l:'TOTAL ASSETS', v: s.total_assets ?? 0}, 
          {l:'ONLINE STATUS', v: s.online_status ?? '0/0'}, 
          {l:'AVAILABILITY PCT', v: s.availability_pct ?? '0%'}, 
          {l:'MISSING EDR', v: s.missing_edr_count ?? 0}
        ];
      case 'backups': 
        return [
          {l:'VMS PROTECTED', v: s.vms_protected ?? 0}, 
          {l:'REPOSITORIES', v: s.unique_repositories ?? 0}, 
          {l:'HEALTH %', v: s.infrastructure_health ?? '0%'}, 
          {l:'RESTORE POINTS', v: s.total_restore_points ?? '0'}
        ];
      case 'email': 
        return [
          {l:'CRIT RISKS', v: s.critical_risks ?? 0}, 
          {l:'TRAVEL', v: s.unlikely_travel ?? 0}, 
          {l:'SPRAYS', v: s.password_sprays ?? 0}, 
          {l:'CONSENT', v: s.remediation_reqs ?? 0}, 
          {l:'USERS', v: s.unique_users ?? 0}, 
          {l:'INBOUND 24H', v: s.inbound_24h ?? 0}
        ];
      default: return [];
    }
  };

  const exportPDF = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    const targetDate = reportData.report_week || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let reportHtml = `
      <style>
        body { 
          font-family: sans-serif; 
          padding: 40px; 
          color: #1a1a1a; 
          line-height: 1.4; 
          background: #fff; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        .header { border-bottom: 5px solid #004a99; padding-bottom: 15px; margin-bottom: 30px; }
        h1 { margin: 0; color: #004a99; font-size: 20px; font-weight: 900; }
        .blurb { font-style: italic; color: #444; font-size: 11px; margin: 10px 0 15px 0; padding-left: 10px; border-left: 2px solid #ddd; }
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .stat-card { border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center; background: #fafafa !important; }
        .stat-val { font-size: 16px; font-weight: 900; color: #0284c7; }
        .stat-label { font-size: 6px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-top: 4px; }
        .note-box { margin-top: 15px; padding: 15px; background: #fef3c7 !important; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; }
        .briefing-box { background: #f1f5f9 !important; border-color: #cbd5e1; margin-bottom: 20px; }
        .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; font-weight: bold; }
        
        /* IMAGE CONSTRAINTS (Fixes the bleed) */
        .img-wrapper { page-break-inside: avoid; margin-top: 20px; text-align: center; }
        .img-wrapper img { max-width: 100%; max-height: 450px; object-fit: contain; border-radius: 12px; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }

        /* REPEATING HEADER HACK */
        .widget-container { position: relative; page-break-before: always; margin-top: 30px; }
        
        .main-header-overlay {
          position: absolute; top: 0; left: 0; right: 0;
          background-color: #004a99 !important; padding: 12px;
          z-index: 10; border-radius: 4px 4px 0 0;
        }
        .main-header-overlay h2 {
          color: #ffffff !important; margin: 0; font-size: 16px; text-transform: uppercase; font-weight: 800;
        }

        table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
        thead { display: table-header-group; }
        tbody { page-break-inside: auto; }
        tr { page-break-inside: auto; page-break-after: auto; }
        td, th { padding: 0; text-align: left; }
        
        .sub-header-cell {
          height: 48px; vertical-align: middle;
          background-color: #f8fafc !important;
          border-bottom: 2px solid #cbd5e1;
        }
        .sub-header-content {
          color: #475569 !important; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 0 12px;
        }
      </style>
      <div class="header">
        <h1>North Idaho College Weekly Infrastructure Report (WiR) -- ${targetDate}</h1>
        <p style="font-weight:bold; color:#666;">Report Boundary Date Range: ${targetDate}</p>
      </div>
    `;

    if (reportData.global_briefing) {
        reportHtml += `<div class="note-box briefing-box"><strong>Executive Briefing:</strong><br/>${reportData.global_briefing}</div>`;
    }

    reportHtml += `
      <div style="margin-top:20px; padding:15px; background:#f8fafc !important; border: 1px solid #e2e8f0; border-radius:8px;">
        <h3 style="margin-top:0; color:#0f172a; font-size:14px; text-transform:uppercase;">Table of Contents / Managed Collectors</h3>
        <ul style="font-size:12px; color:#334155; columns: 2; margin-bottom:0;">
          ${WIDGETS.map(w => `<li style="margin-bottom:6px;"><strong>${w.title}</strong><br/><span style="font-size:10px; color:#64748b;">${w.blurb}</span></li>`).join('')}
        </ul>
      </div>
    `;

    WIDGETS.forEach(w => {
      const data = reportData[w.id]; if (!data) return;
      reportHtml += `
      <div class="widget-container">
        <div class="main-header-overlay">
          <h2>${w.title}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th class="sub-header-cell">
                <div class="sub-header-content">${w.title} (Continued)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="page-break-inside: avoid;">
                  <div class="blurb">${w.blurb}</div>
                  <div class="stat-grid">`;
      getExecutiveBoxes(w.id, data.metrics).forEach(b => {
        reportHtml += `<div class="stat-card"><div class="stat-val">${b.v}</div><div class="stat-label">${b.l}</div></div>`;
      });
      reportHtml += `     </div>
                </div>`;
      if (data.note) reportHtml += `<div class="note-box" style="page-break-inside: avoid;"><strong>Executive Notes:</strong><br/>${data.note}</div>`;
      if (data.images) data.images.forEach(img => { reportHtml += `<div class="img-wrapper"><img src="${img}" /></div>`; });
      reportHtml += `
              </td>
            </tr>
          </tbody>
        </table>
      </div>`;
    });
    reportHtml += `<div class="footer">North Idaho College WiR - built by Don Murphy (AE:2026)</div>`;
    doc.write(reportHtml); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); document.body.removeChild(iframe); }, 1000);
  };

  const renderWidget = (w, isDash) => {
    const data = reportData[w.id];
    const m = data?.metrics;
    const boxes = getExecutiveBoxes(w.id, m);
    return (
      <div key={w.id} className={`bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isDash ? 'h-full' : 'mb-8'}`}>
        <div className="p-4 bg-[#1c2128] border-b border-gray-800 flex justify-between items-center text-left">
          <div className="flex items-center space-x-3">{w.icon} <span className="font-bold text-[11px] uppercase tracking-widest text-gray-200">{w.title}</span></div>
          <div className="flex items-center space-x-2">
            {w.dash && <a href={w.dash} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-600/20 rounded-full border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase transition hover:bg-blue-600/40 flex items-center space-x-1"><ExternalLink size={10}/> <span>Open Dash</span></a>}
            {w.appUrl && <a href={w.appUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-emerald-600/20 rounded-full border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase transition hover:bg-emerald-600/40 flex items-center space-x-1"><ExternalLink size={10}/> <span>Open App</span></a>}
            {!isDash && <button onClick={() => fetchMetrics(w.id)} className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400 transition-colors"><RefreshCw size={14} className={loading[w.id] ? 'animate-spin' : ''}/></button>}
            <label className="p-1.5 hover:bg-gray-700 rounded-md cursor-pointer text-gray-400 transition-colors"><Camera size={14}/><input type="file" className="hidden" onChange={e => handleImageUpload(w.id, e.target.files[0])}/></label>
          </div>
        </div>
        <div className="p-6 flex-grow text-left">
          <div className="text-[10px] text-gray-500 italic mb-6 leading-relaxed border-l-2 border-gray-800 pl-4">{w.blurb}</div>
          <div className="space-y-5">
             <div className="grid grid-cols-3 gap-3 mb-6">
               {boxes.map(b => (
                 <div key={b.l} className="bg-black/40 p-4 rounded-xl border border-gray-800 text-center flex flex-col justify-center min-h-[90px]">
                   <div className="text-2xl font-black text-blue-400">{b.v ?? '0'}</div>
                   <div className="text-[8px] text-gray-500 uppercase font-black mt-1 tracking-tighter">{b.l}</div>
                 </div>
               ))}
             </div>
             {w.id === 'network' && m?.uptime_trends && m.uptime_trends.length > 0 && (
               <div className="bg-black/20 p-4 rounded-xl border border-gray-800 h-32 w-full mt-4">
                  <div className="text-[10px] text-gray-500 uppercase font-black mb-2 text-left tracking-widest">Availability Trend</div>
                  <div className="h-16 w-full"><Line data={{ labels: Array(m.uptime_trends.length).fill(''), datasets: [{ data: m.uptime_trends, borderColor: '#00e0ff', tension: 0.4, pointRadius: 0, fill: true, backgroundColor: 'rgba(0, 224, 255, 0.1)' }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false, min: 90 }, x: { display: false } } }} /></div>
               </div>
             )}
          </div>
          {data?.images && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              {data.images.map((img, idx) => (
                <div key={idx} className="group relative">
                  <img src={img} className="w-full h-32 object-cover rounded-lg border border-gray-800 cursor-zoom-in hover:brightness-110 transition-all" onClick={() => setSelectedImg(img)} />
                  <button onClick={() => removeImage(w.id, idx)} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 text-white shadow-lg"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          {!isDash && <textarea className="w-full bg-black/40 rounded-2xl p-5 text-[13px] text-gray-300 outline-none border border-gray-800 focus:border-blue-500/50 mt-8 h-32 transition-all" placeholder="Enter briefing notes..." value={data?.note || ''} onFocus={() => setIsEditingFocus(true)} onBlur={() => setIsEditingFocus(false)} onChange={e => updateNote(w.id, e.target.value)}/>}
          {isDash && data?.note && <div className="mt-8 text-[14px] text-gray-300 bg-blue-900/10 p-5 rounded-2xl border border-blue-500/20 italic border-l-4 border-l-blue-500 shadow-xl text-left leading-relaxed">{data.note}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-300 font-sans overflow-hidden text-left">
      {showArchives && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 bg-[#1c2128] border-b border-gray-800 flex justify-between items-center text-left">
                    <h2 className="text-xl font-black flex items-center gap-3"><FolderOpen/> WiR VAULT & FILE MANAGER</h2>
                    <button onClick={() => setShowArchives(false)} className="p-2 hover:bg-gray-800 rounded-full"><X/></button>
                </div>
                <div className="overflow-y-auto p-4 space-y-2 text-left bg-black/20">
                    {archiveList.map(f => (
                        <div key={f.name} className="flex justify-between items-center p-4 bg-[#0d1117] rounded-xl border border-gray-800 hover:border-blue-500 group">
                            <div className="flex items-center gap-4">
                                <FileJson className="text-blue-500"/>
                                <div><div className="font-bold text-gray-100">{f.name}</div><div className="text-[10px] text-gray-500 uppercase">{new Date(f.time).toLocaleString()}</div></div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => restoreArchive(f.name)} className="px-3 py-1.5 bg-blue-600 rounded text-white text-[10px] font-black uppercase flex items-center gap-1">Restore</button>
                                <button onClick={() => renameFile(f.name)} className="px-3 py-1.5 bg-gray-700 rounded text-white text-[10px] font-black uppercase">Rename</button>
                                <a href={`/api/download-archive/${f.name}`} className="px-3 py-1.5 bg-emerald-600 rounded text-white text-[10px] font-black uppercase">DL</a>
                                <button onClick={() => deleteArchive(f.name)} className="p-1.5 bg-red-600/20 text-red-400 rounded border border-red-500/20 hover:bg-red-600 hover:text-white"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showAudit && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 bg-[#1c2128] border-b border-gray-800 flex justify-between items-center text-left">
                    <h2 className="text-xl font-black flex items-center gap-3"><List/> TEAM AUDIT TRAILS (LAST 100)</h2>
                    <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-gray-800 rounded-full"><X/></button>
                </div>
                <div className="overflow-y-auto p-4 font-mono text-xs bg-black/20">
                    {auditLogs.map((log, i) => (
                        <div key={i} className="mb-2 p-2 border-b border-gray-800 flex items-start gap-4">
                            <span className="text-blue-500 font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className="text-emerald-500 font-black uppercase">{log.action}:</span>
                            <span className="text-gray-300">{log.details}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {selectedImg && <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedImg(null)}><img src={selectedImg} className="max-w-full max-h-full rounded shadow-2xl animate-in zoom-in" /></div>}
      
      <div className="w-16 border-r border-gray-800 flex flex-col items-center py-8 bg-[#010409]">
        <Zap className="text-yellow-500 w-10 h-10 mb-8" title="WiRBuilder Pro System Engine" />
        <div className="space-y-10 flex flex-col items-center">
            <button title="Toggle Layout Editor Grid" onClick={() => setViewMode('builder')} className={`p-4 rounded-2xl transition-all ${viewMode === 'builder' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-800'}`}><Layout size={26}/></button>
            <button title="Toggle Executive Dashboard Mode" onClick={() => setViewMode('dashboard')} className={`p-4 rounded-2xl transition-all ${viewMode === 'dashboard' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-800'}`}><Eye size={26}/></button>
            <button title="Toggle System Logging Terminal" onClick={() => setShowTerminal(!showTerminal)} className={`p-4 rounded-2xl transition-all ${showTerminal ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}><Terminal size={26}/></button>
            <button title="View Team Audit Trail Logs" onClick={openAuditLogs} className="p-4 rounded-2xl text-gray-500 hover:bg-gray-800"><List size={26}/></button>
            <button title="Trigger Atomic Manual Save to Server" onClick={() => saveDraftToServer(null, true)} className="p-4 rounded-2xl text-emerald-500 hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/20 transition-all"><Save size={26}/></button>
            <div className="h-[1px] w-8 bg-gray-800" />
            <button title="Open Archived Report File Vault" onClick={openArchiveVault} className="p-3 text-gray-500 hover:text-blue-400"><FolderOpen size={24}/></button>
            <button title="Finalize Current Week Data to History Vault" onClick={archiveCurrentReport} className="p-3 text-gray-500 hover:text-emerald-400"><Archive size={24}/></button>
            <button title="Compile and Print Branded Executive PDF Report" onClick={exportPDF} className="p-3 text-gray-500 hover:text-emerald-400"><FileType size={24}/></button>
            <button title="Purge Working Board and Reset Draft Workspace" onClick={async () => { 
                if (window.confirm("Clear board?")) { 
                    await fetch('/api/draft', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) });
                    setReportData({}); localStorage.removeItem('wir_working_draft');
                    addLog(">>> [CLEAN] Shared board cleared.");
                } 
            }} className="p-3 text-gray-500 hover:text-rose-500 transition-colors"><Trash2 size={22}/></button>
        </div>
      </div>
      
      {/* FIX: Connected the core tracking reference hook right onto your true scroll dashboard element */}
      <div ref={scrollContainerRef} className="flex-grow overflow-auto p-12 bg-[#010409]">
        <div className="max-w-[1500px] mx-auto text-left">
          <header className="flex justify-between items-start mb-16 border-b border-gray-800 pb-10">
            <div>
              <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none">WiRBuilder Pro<span className="text-blue-500"> - Collab Edition</span></h1>
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.5em] mt-4 ml-1 italic leading-relaxed">Weekly Infrastructure Report (WiR)</p>
              <div className="flex items-center gap-4 mt-6">
                  <div className="bg-blue-600/10 border border-blue-500/30 px-5 py-3 rounded-xl flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Working on Week of:</span>
                      {isEditingDate ? (
                          <div className="flex items-center gap-2">
                              <input 
                                className="bg-black border border-gray-700 text-white text-xs px-2 py-1 rounded outline-none focus:border-blue-500" 
                                value={reportData.report_week || ""} 
                                onFocus={() => setIsEditingFocus(true)}
                                onBlur={() => setIsEditingFocus(false)}
                                onChange={(e) => setReportData({...reportData, report_week: e.target.value})} 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingFocus(false);
                                        setIsEditingDate(false);
                                        saveDraftToServer(null, true);
                                    }
                                }}
                              />
                              <button 
                                onMouseDown={(e) => e.preventDefault()} 
                                onClick={() => { setIsEditingFocus(false); setIsEditingDate(false); saveDraftToServer(null, true); }} 
                                className="text-emerald-400"
                              >
                                <Check size={16}/>
                              </button>
                          </div>
                      ) : (
                          <div className="flex items-center gap-3">
                              <span className="text-white font-bold text-sm tracking-tight">{reportData.report_week || "Not Set"}</span>
                              <button onClick={() => setIsEditingDate(true)} className="text-gray-500 hover:text-blue-400"><Edit3 size={14}/></button>
                          </div>
                      )}
                  </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex space-x-3 justify-end">
                <button onClick={pollAllWidgets} disabled={isSyncingAll} className="flex items-center space-x-3 px-6 py-4 rounded-full border border-blue-500/40 text-blue-400 bg-blue-600/10 font-black hover:bg-blue-600 hover:text-white transition-all uppercase text-xs">
                  {isSyncingAll ? <RefreshCw className="animate-spin" /> : <PlayCircle size={18} />} <span>Poll All Widgets</span>
                </button>
                <button onClick={() => saveDraftToServer(null, true)} className="flex items-center space-x-3 px-6 py-4 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-600/10 font-black hover:bg-emerald-600 hover:text-white transition-all uppercase text-xs"><Save size={18}/> <span>Manual Save</span></button>
              </div>
              {showTerminal && (
                <div className="w-[700px] bg-black border border-gray-800 rounded-lg p-3 flex flex-col h-48 shadow-inner">
                  <div className="flex justify-between items-center bg-gray-900 px-2 py-1 border-b border-gray-800 mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">System Logs Terminal</span>
                    <button onClick={copyLogs} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-bold uppercase"><Copy size={10}/> <span>Copy Logs</span></button>
                  </div>
                  <div className="flex-grow overflow-y-auto font-mono text-[10px] text-blue-400 text-left">
                    {logs.map((log, i) => <div key={i} className="border-b border-gray-900 pb-1 mb-1">{log}</div>)}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="mb-12">
              <div className="flex items-center gap-3 mb-4 text-gray-500">
                  <MessageSquare size={18}/>
                  <span className="text-[10px] font-black uppercase tracking-widest">Global Executive Briefing</span>
              </div>
              <textarea 
                className="w-full bg-[#161b22] border border-gray-800 rounded-2xl p-6 text-sm text-gray-300 outline-none focus:border-blue-500/50 transition-all min-h-[150px] shadow-2xl"
                placeholder="Enter summary information for the week here..."
                value={reportData.global_briefing || ""}
                onFocus={() => setIsEditingFocus(true)}
                onBlur={() => setIsEditingFocus(false)}
                onChange={(e) => {
                    const updated = { ...reportData, global_briefing: e.target.value };
                    setReportData(updated);
                    saveDraftToServer(updated);
                }}
              />
          </div>

          {/* TABLE OF CONTENTS / MANAGED COLLECTORS LIST */}
          <div className="mb-12 bg-[#161b22] border border-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 text-gray-500">
                  <List size={18}/>
                  <span className="text-[10px] font-black uppercase tracking-widest">Table of Contents / Managed Collectors</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WIDGETS.map((w, i) => (
                      <div key={w.id} className="flex items-start gap-3 p-4 bg-black/40 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                          <div className="mt-0.5">{w.icon}</div>
                          <div>
                              <div className="text-xs font-bold text-gray-300">{i + 1}. {w.title}</div>
                              <div className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{w.blurb}</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {WIDGETS.map(w => renderWidget(w, viewMode === 'dashboard'))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;