import React, { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, Zap, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const NISTDashboard = () => {
    const [maturityData, setMaturityData] = useState([
        { subject: 'GOVERN', A: 0, fullMark: 4 },
        { subject: 'IDENTIFY', A: 0, fullMark: 4 },
        { subject: 'PROTECT', A: 0, fullMark: 4 },
        { subject: 'DETECT', A: 0, fullMark: 4 },
        { subject: 'RESPOND', A: 0, fullMark: 4 },
        { subject: 'RECOVER', A: 0, fullMark: 4 },
    ]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock data fetch for initialization
        setLoading(false);
    }, []);

    return (
        <div className="bg-[#010409] text-gray-200 min-h-screen p-10 font-sans">
            <header className="mb-10 border-b border-gray-800 pb-8">
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">NIST CSF 2.0 Governance</h1>
                <p className="text-gray-500 mt-2 text-sm max-w-4xl">
                    Executive Overview: Mapping North Idaho College Security Posture to the NIST CSF 2.0 framework. 
                    This dashboard provides automated maturity scoring based on real-time telemetry from core security collectors.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-[#161b22] p-8 rounded-2xl border border-gray-800 shadow-xl">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Zap size={20} className="text-blue-500"/> Function Maturity Radar</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={maturityData}>
                                <PolarGrid stroke="#333" />
                                <PolarAngleAxis dataKey="subject" tick={{fill: '#9ca3af', fontSize: 12}} />
                                <PolarRadiusAxis angle={30} domain={[0, 4]} tick={false} axisLine={false} />
                                <Radar name="Maturity" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333'}} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-[#161b22] p-8 rounded-2xl border border-gray-800 shadow-xl">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Shield size={20} className="text-emerald-500"/> Compliance Drill-Down</h2>
                    <div className="space-y-4">
                        {['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'].map((func) => (
                            <div key={func} className="p-4 bg-[#0d1117] border border-gray-800 rounded-xl flex justify-between items-center">
                                <span className="font-bold text-xs uppercase tracking-widest">{func}</span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase">Status: <span className="text-gray-300">AWAITING DATA</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NISTDashboard;
