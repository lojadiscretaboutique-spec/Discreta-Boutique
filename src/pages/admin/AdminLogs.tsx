import { useEffect, useState } from 'react';
import { auditLogService, AuditLog } from '../../services/auditLogService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '../../components/ui/input';

export function AdminLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  useEffect(() => {
    auditLogService.listLogs(100).then(setLogs);
  }, []);

  useEffect(() => {
    setFilteredLogs(logs.filter(log => 
      (userFilter === '' || log.userName.toLowerCase().includes(userFilter.toLowerCase())) &&
      (moduleFilter === 'all' || log.module === moduleFilter)
    ));
  }, [logs, userFilter, moduleFilter]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Auditoria de Segurança</h1>
      
      <div className="flex gap-4">
        <Input placeholder="Buscar usuário..." onChange={e => setUserFilter(e.target.value)} />
        <select 
            className="border rounded px-3 py-2 text-sm bg-slate-900"
            value={moduleFilter} 
            onChange={e => setModuleFilter(e.target.value)}
        >
            <option value="all">Todos os módulos</option>
            <option value="products">Produtos</option>
            <option value="stock">Estoque</option>
            <option value="users">Usuários</option>
            <option value="settings">Configurações</option>
        </select>
      </div>

      <div className="bg-slate-900 border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-800 border-b">
            <tr>
              <th className="p-3 text-left w-32">Data</th>
              <th className="p-3 text-left w-48">Usuário</th>
              <th className="p-3 text-left w-32">Módulo</th>
              <th className="p-3 text-left">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-b">
                <td className="p-3">{log.createdAt ? format(log.createdAt.toDate(), "dd/MM HH:mm", {locale: ptBR}) : '-'}</td>
                <td className="p-3 whitespace-normal break-words">{log.userName}</td>
                <td className="p-3 capitalize">{log.module}</td>
                <td className="p-3 whitespace-normal break-words">{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
