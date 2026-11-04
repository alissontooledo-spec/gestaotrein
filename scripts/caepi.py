#!/usr/bin/env python3
"""GRID · base de CAs do Ministério do Trabalho (CAEPI) → tabela epi_ca do Supabase.
Roda toda semana pelo GitHub Actions (.github/workflows/caepi.yml). Só precisa do segredo
SUPABASE_SERVICE_ROLE_KEY no repositório. Uma linha por CA (a de validade mais recente),
só as colunas que o GRID usa (~10 MB no banco em vez de 145 MB do arquivo).
Uso local para conferir sem gravar: python3 scripts/caepi.py --seco
"""
import ftplib, io, json, os, sys, zipfile, urllib.request, datetime

HOST = 'ftp.mtps.gov.br'
PASTA = '/portal/fiscalizacao/seguranca-e-saude-no-trabalho/caepi/'
ARQ = 'tgg_export_caepi.zip'
URL = os.environ.get('SUPABASE_URL', 'https://cldbqcpnzitwqvgqbipz.supabase.co')
CHAVE = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
SECO = '--seco' in sys.argv

def baixar():
    ftp = ftplib.FTP(HOST, timeout=120); ftp.login(); ftp.cwd(PASTA)
    data = None
    try:
        r = ftp.sendcmd('MDTM ' + ARQ)            # "213 20260716230242"
        data = datetime.datetime.strptime(r.split()[1][:8], '%Y%m%d').date().isoformat()
    except Exception:
        pass
    buf = io.BytesIO(); ftp.retrbinary('RETR ' + ARQ, buf.write); ftp.quit()
    return buf.getvalue(), data

def ler(zbytes):
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    txt = z.read(z.namelist()[0]).decode('utf-8', errors='replace')
    melhor = {}
    for ln in txt.splitlines()[1:]:
        c = ln.split('|')
        if len(c) < 13 or not c[0].strip().isdigit(): continue
        ca = c[0].strip()
        try: val = datetime.datetime.strptime(c[1].strip(), '%d/%m/%Y').date().isoformat()
        except ValueError: val = None
        lin = {'ca': ca, 'validade': val, 'situacao': c[2].strip()[:30], 'cnpj': c[4].strip()[:20], 'fabricante': c[5].strip()[:200],
               'equipamento': c[7].strip()[:200], 'descricao': c[8].strip()[:500], 'marca': c[9].strip()[:120], 'referencia': c[10].strip()[:200],
               'aprovado_para': c[12].strip()[:500]}
        ant = melhor.get(ca)
        if ant is None or (val or '') > (ant['validade'] or ''): melhor[ca] = lin
    return list(melhor.values())

def enviar(caminho, linhas, conflito=None):
    url = f'{URL}/rest/v1/{caminho}' + (f'?on_conflict={conflito}' if conflito else '')
    req = urllib.request.Request(url, data=json.dumps(linhas).encode(), method='POST', headers={
        'apikey': CHAVE, 'Authorization': f'Bearer {CHAVE}', 'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'})
    with urllib.request.urlopen(req, timeout=120) as r:
        if r.status >= 300: raise SystemExit(f'Falha ao gravar: {r.status}')

def main():
    zb, data = baixar()
    linhas = ler(zb)
    print(f'Arquivo do Ministério: {data or "data desconhecida"} · {len(linhas)} CAs')
    if SECO:
        print(json.dumps(linhas[:2], ensure_ascii=False, indent=1)); return
    if not CHAVE: raise SystemExit('Falta o segredo SUPABASE_SERVICE_ROLE_KEY no GitHub.')
    if len(linhas) < 10000: raise SystemExit('Arquivo do Ministério veio incompleto. Nada foi gravado.')
    for i in range(0, len(linhas), 1000):
        enviar('epi_ca', linhas[i:i + 1000], 'ca')
    enviar('epi_ca_info', [{'id': 1, 'data_arquivo': data, 'cas': len(linhas), 'atualizado_em': datetime.datetime.utcnow().isoformat() + 'Z'}], 'id')
    print('Base de CAs atualizada.')

if __name__ == '__main__':
    main()
