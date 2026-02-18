import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, Activity, Lock, Server } from 'lucide-react';

interface SecurityPlugin {
  name: string;
  version: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  protectsAgainst: string[];
}

interface SecurityStatus {
  overall: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  totalPlugins: number;
  activePlugins: number;
  plugins: SecurityPlugin[];
  recommendations: string[];
  lastUpdated: string;
}

const SecurityStatus: React.FC = () => {
  const [securityData, setSecurityData] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSecurityStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSecurityStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_URL}/api/security/status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security status');
      }
      
      const data = await response.json();
      setSecurityData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('HTTP') || category.includes('Headers')) return Shield;
    if (category.includes('Rate')) return Activity;
    if (category.includes('Auth') || category.includes('Encryption')) return Lock;
    if (category.includes('Database')) return Server;
    return CheckCircle;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'HTTP Security Headers': 'bg-blue-100 text-blue-700',
      'Rate Limiting': 'bg-purple-100 text-purple-700',
      'Input Validation': 'bg-green-100 text-green-700',
      'Database Security': 'bg-indigo-100 text-indigo-700',
      'XSS Protection': 'bg-red-100 text-red-700',
      'Input Protection': 'bg-yellow-100 text-yellow-700',
      'CSRF Protection': 'bg-orange-100 text-orange-700',
      'Access Control': 'bg-pink-100 text-pink-700',
      'Encryption': 'bg-cyan-100 text-cyan-700',
      'Authentication': 'bg-teal-100 text-teal-700',
      'Logging & Monitoring': 'bg-gray-100 text-gray-700',
      'Frontend XSS Protection': 'bg-rose-100 text-rose-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading security status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Security Status</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchSecurityStatus}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!securityData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Status</h1>
              <p className="text-gray-600">
                Monitor all security plugins protecting your website
              </p>
            </div>
            <button
              onClick={fetchSecurityStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Status Card */}
        <div className={`rounded-xl p-6 mb-8 ${getOverallColor(securityData.overall)} border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-12 h-12" />
              <div>
                <h2 className="text-2xl font-bold capitalize">{securityData.overall} Security</h2>
                <p className="text-sm opacity-80">
                  {securityData.activePlugins} of {securityData.totalPlugins} plugins active
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{securityData.score}%</div>
              <p className="text-sm opacity-80">Security Score</p>
            </div>
          </div>
          
          {/* Recommendations */}
          {securityData.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <h3 className="font-semibold mb-2">Recommendations:</h3>
              <ul className="space-y-1">
                {securityData.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Category Filters */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Security Plugins by Category</h3>
        </div>

        {/* Security Plugins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityData.plugins.map((plugin, index) => {
            const Icon = getCategoryIcon(plugin.category);
            
            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Plugin Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(plugin.category)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                      <p className="text-xs text-gray-500">{plugin.version}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    plugin.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {plugin.status}
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mb-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(plugin.category)}`}>
                    {plugin.category}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">
                  {plugin.description}
                </p>

                {/* Protections */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                    Protects Against:
                  </h4>
                  <ul className="space-y-1">
                    {plugin.protectsAgainst.map((threat, idx) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-green-600 font-bold">•</span>
                        <span>{threat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Last updated: {new Date(securityData.lastUpdated).toLocaleString()}
          </p>
          <p className="mt-2">
            All security plugins are open-source and free to use
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecurityStatus;
