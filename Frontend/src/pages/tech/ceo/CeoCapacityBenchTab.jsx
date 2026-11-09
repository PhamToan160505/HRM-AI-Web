import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserCheck,
  Clock,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

const getShortEngineerName = (fullName) => {
  if (!fullName) return 'Kỹ sư';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
};

function CapacityTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white p-3 rounded-xl shadow-xl border border-blue-800/80 text-xs max-w-xs space-y-1.5">
      <div>
        <p className="font-bold text-white">{item.fullName}</p>
        <p className="text-[11px] text-blue-200">{item.chucVu}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-800/80 tabular">
        <div>
          <span className="text-[10px] text-blue-200/80 block">Tổng tải hiện tại</span>
          <span className="font-extrabold text-sm text-white">{item.allocation}%</span>
        </div>
        <div>
          <span className="text-[10px] text-blue-200/80 block">Còn trống (Bench)</span>
          <span className="font-extrabold text-sm text-emerald-300">{item.available}%</span>
        </div>
      </div>
      {item.projects && item.projects.length > 0 && (
        <div className="pt-1 border-t border-blue-800/80">
          <span className="text-[10px] text-blue-200/80 block mb-0.5">Dự án tham gia:</span>
          <p className="text-[11px] text-blue-50 leading-snug">{item.projects.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

export default function CeoCapacityBenchTab({ benchUsers = [], onInspectEngineer }) {
  const [keyword, setKeyword] = useState('');
  const [capacityFilter, setCapacityFilter] = useState(''); // '' | 'bench' | 'full' | 'overloaded'

  const summary = useMemo(() => {
    const totalEngineers = benchUsers.length;
    const totalCapacityPool = totalEngineers * 100;
    const totalAllocated = benchUsers.reduce((acc, u) => acc + (u.totalAllocation || 0), 0);
    const totalBenchPool = benchUsers.reduce((acc, u) => acc + (u.availableCapacity || 0), 0);

    const benchList = benchUsers.filter((u) => (u.availableCapacity || 0) > 0);
    const fullList = benchUsers.filter((u) => (u.totalAllocation || 0) === 100);
    const overloadedList = benchUsers.filter((u) => (u.totalAllocation || 0) > 100 || u.isOverloaded);

    const avgUtilization = totalEngineers > 0 ? Math.round(totalAllocated / totalEngineers) : 0;

    return {
      totalEngineers,
      totalCapacityPool,
      totalAllocated,
      totalBenchPool,
      benchCount: benchList.length,
      fullCount: fullList.length,
      overloadedCount: overloadedList.length,
      avgUtilization,
      fteAvailable: (totalBenchPool / 100).toFixed(1),
      fteDeployed: (totalAllocated / 100).toFixed(1),
    };
  }, [benchUsers]);

  const chartData = useMemo(() => {
    return benchUsers.map((u) => {
      const alloc = u.totalAllocation || 0;
      let fill = '#2563EB';
      if (alloc > 100 || u.isOverloaded) fill = '#E11D48';
      else if (alloc < 100) fill = '#059669';

      return {
        userId: u.userId,
        shortName: getShortEngineerName(u.hoTen),
        fullName: u.hoTen,
        chucVu: u.chucVu || 'Kỹ sư phần mềm',
        allocation: alloc,
        available: u.availableCapacity || 0,
        projects: u.activeProjectNames || [],
        fill,
      };
    });
  }, [benchUsers]);

  const filteredUsers = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return benchUsers.filter((u) => {
      const isOverloaded = (u.totalAllocation || 0) > 100 || u.isOverloaded;
      const isAvailable = (u.availableCapacity || 0) > 0;
      const isFull = (u.totalAllocation || 0) === 100;

      if (capacityFilter === 'bench' && !isAvailable) return false;
      if (capacityFilter === 'full' && !isFull) return false;
      if (capacityFilter === 'overloaded' && !isOverloaded) return false;

      if (!kw) return true;
      const matchName = u.hoTen?.toLowerCase().includes(kw);
      const matchEmail = u.email?.toLowerCase().includes(kw);
      const matchRole = u.chucVu?.toLowerCase().includes(kw);
      const matchProj = (u.activeProjectNames || []).some((p) => p.toLowerCase().includes(kw));
      return matchName || matchEmail || matchRole || matchProj;
    });
  }, [benchUsers, keyword, capacityFilter]);

  return (
    <div className="space-y-5">
      {/* 1. Analytics Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Bar Chart Engineer Load */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Biểu đồ Phân bổ Công suất từng Kỹ sư</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh % tải công việc thực tế với ngưỡng tối ưu 100% (1.0 FTE)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" /> Có thể gán việc (&lt;100%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Full 100%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" /> Quá tải (&gt;100%)
              </span>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              Chưa có dữ liệu công suất kỹ sư.
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 22, right: 20, left: -12, bottom: 4 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, (dataMax) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CapacityTooltip />} cursor={{ fill: '#EFF6FF' }} />
                  <ReferenceLine
                    y={100}
                    stroke="#1E3A8A"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'Ngưỡng 100%',
                      position: 'insideTopRight',
                      dy: -16,
                      fill: '#1E3A8A',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                  <Bar
                    dataKey="allocation"
                    radius={[8, 8, 2, 2]}
                    onClick={(entry) => {
                      if (entry?.userId && onInspectEngineer) {
                        onInspectEngineer(entry.userId);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right: Capacity Pool & Clickable Filter Buckets */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hiệu suất Khai thác Nguồn lực</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng quỹ công suất phòng Công nghệ ({summary.totalEngineers} kỹ sư)
                </p>
              </div>
              <div className="text-right tabular">
                <span className="text-2xl font-extrabold text-[#1E3A8A]">{summary.avgUtilization}%</span>
                <span className="block text-[10px] font-semibold text-slate-400">Tải trung bình</span>
              </div>
            </div>

            {/* Segmented Utilization Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between text-xs tabular">
                <span className="font-semibold text-slate-700">
                  Đã phân bổ: <strong className="text-blue-700">{summary.fteDeployed} FTE</strong>
                </span>
                <span className="font-semibold text-emerald-700">
                  Còn trống: <strong>{summary.fteAvailable} FTE</strong>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
                <div
                  className={`h-full ${summary.avgUtilization > 100 ? 'bg-rose-600' : 'bg-blue-600'}`}
                  style={{ width: `${Math.min(100, summary.avgUtilization)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3 Clickable Health Buckets */}
          <div className="space-y-2">
            {[
              {
                key: 'bench',
                title: 'Ghế chờ / Còn dung lượng trống',
                desc: 'Sẵn sàng tiếp nhận dự án mới',
                count: summary.benchCount,
                tone: 'emerald',
                icon: Clock,
              },
              {
                key: 'full',
                title: 'Vận hành tối ưu (Full 100%)',
                desc: 'Khai thác trọn vẹn định mức',
                count: summary.fullCount,
                tone: 'blue',
                icon: CheckCircle2,
              },
              {
                key: 'overloaded',
                title: 'Vượt ngưỡng công suất (> 100%)',
                desc: 'Cần theo dõi rủi ro quá tải',
                count: summary.overloadedCount,
                tone: 'rose',
                icon: AlertTriangle,
              },
            ].map((bucket) => {
              const IconComp = bucket.icon;
              const isSelected = capacityFilter === bucket.key;
              const toneStyles =
                bucket.tone === 'emerald'
                  ? {
                      active: 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400',
                      icon: 'bg-emerald-100 text-emerald-700',
                      count: 'text-emerald-700',
                    }
                  : bucket.tone === 'rose'
                  ? {
                      active: 'bg-rose-50 border-rose-400 ring-1 ring-rose-400',
                      icon: 'bg-rose-100 text-rose-700',
                      count: 'text-rose-700',
                    }
                  : {
                      active: 'bg-blue-50 border-blue-400 ring-1 ring-blue-400',
                      icon: 'bg-blue-100 text-blue-700',
                      count: 'text-blue-700',
                    };

              return (
                <button
                  type="button"
                  key={bucket.key}
                  onClick={() => setCapacityFilter(isSelected ? '' : bucket.key)}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? toneStyles.active
                      : 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneStyles.icon}`}>
                      <IconComp size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{bucket.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{bucket.desc}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular">
                    <span className={`text-lg font-extrabold ${toneStyles.count}`}>{bucket.count}</span>
                    <span className="text-[10px] text-slate-400 block">kỹ sư</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Search & Filter Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm kỹ sư, chức vụ hoặc dự án đang làm..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: '', label: `Tất cả (${benchUsers.length})` },
              { key: 'bench', label: `Còn dung lượng (${summary.benchCount})` },
              { key: 'full', label: `Full 100% (${summary.fullCount})` },
              { key: 'overloaded', label: `Quá tải (${summary.overloadedCount})` },
            ].map((pill) => (
              <button
                type="button"
                key={pill.key || 'all'}
                onClick={() => setCapacityFilter(pill.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer tabular ${
                  capacityFilter === pill.key
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2">
            <Users size={34} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Không tìm thấy kỹ sư phù hợp</p>
            <p className="text-xs text-slate-400">Vui lòng thử bỏ bộ lọc hoặc tìm từ khóa khác.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Kỹ sư</th>
                  <th className="py-3.5 px-4">Chức vụ / Phòng ban</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Mức độ phân bổ (% Tải)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Dung lượng còn trống</th>
                  <th className="py-3.5 px-4">Dự án đang làm</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Hồ sơ năng lực</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredUsers.map((user) => {
                  const isOverloaded = (user.totalAllocation || 0) > 100 || user.isOverloaded;
                  const isFull = (user.totalAllocation || 0) === 100;
                  const isAvailable = (user.availableCapacity || 0) > 0;

                  return (
                    <tr key={user.userId} className="hover:bg-blue-50/35 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {user.hoTen ? user.hoTen.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{user.hoTen}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{user.chucVu || 'Kỹ sư phần mềm'}</p>
                        <p className="text-[11px] text-slate-400">{user.departmentName}</p>
                      </td>

                      <td className="py-3.5 px-4 w-48 tabular">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span
                              className={
                                isOverloaded ? 'text-rose-600' : isFull ? 'text-blue-700' : 'text-emerald-700'
                              }
                            >
                              {user.totalAllocation}%
                            </span>
                            <span className={isOverloaded ? 'text-rose-600' : 'text-slate-400 font-medium'}>
                              {isOverloaded ? 'Vượt ngưỡng 100%' : 'Định mức 100%'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOverloaded ? 'bg-rose-500' : isFull ? 'bg-blue-600' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, user.totalAllocation || 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        {isAvailable ? (
                          <span className="inline-block font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 whitespace-nowrap">
                            Rảnh {user.availableCapacity}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium whitespace-nowrap">Hết dung lượng</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {user.activeProjectNames && user.activeProjectNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {user.activeProjectNames.map((pName, pIdx) => (
                              <span
                                key={pIdx}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80"
                              >
                                {pName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa gắn dự án (Ghế chờ)</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isOverloaded ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                            <AlertTriangle size={12} className="shrink-0" /> Quá tải
                          </span>
                        ) : isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                            <CheckCircle2 size={12} className="shrink-0" /> Có thể gán việc
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                            <CheckCircle2 size={12} className="shrink-0" /> Full 100%
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectEngineer && onInspectEngineer(user.userId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                        >
                          <UserCheck size={13} />
                          <span>Tech Profile</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
