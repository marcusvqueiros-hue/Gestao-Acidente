"""Gera o carrossel de divulgação (PNG 1080x1350) do sistema Gestão de Acidentalidade.
Uso: python divulgacao/gerar_carrossel.py   (cria divulgacao/carrossel/slide-01.png ...)
"""
import os
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "carrossel")
LOGO = os.path.join(AQUI, "..", "public", "logo-cgb-escuro.png")
os.makedirs(SAIDA, exist_ok=True)

W, H = 1080, 1350
BG, SURF, LINE = (16, 14, 18), (28, 25, 31), (52, 47, 56)
TXT, MUTED = (244, 241, 245), (165, 158, 170)
ROSA, ROSA2, VINHO = (224, 85, 107), (240, 140, 156), (140, 28, 61)
FONTES = r"C:\Windows\Fonts"


def f(tam, negrito=False):
    return ImageFont.truetype(os.path.join(FONTES, "segoeuib.ttf" if negrito else "segoeui.ttf"), tam)


def novo():
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    # brilho suave no canto
    for r in range(520, 0, -8):
        c = int(16 + (1 - r / 520) * 22)
        d.ellipse((W - r, -r // 2, W + r, r), fill=(c, 14, 18 + (c - 16) // 2))
    return im, ImageDraw.Draw(im)


def quebra(d, texto, fonte, largura):
    linhas, atual = [], ""
    for p in texto.split():
        t = (atual + " " + p).strip()
        if d.textlength(t, font=fonte) <= largura:
            atual = t
        else:
            linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


def paragrafo(d, x, y, texto, fonte, cor, largura, espaco=1.35):
    for ln in quebra(d, texto, fonte, largura):
        d.text((x, y), ln, font=fonte, fill=cor)
        y += int(fonte.size * espaco)
    return y


def cabecalho(im, d, n, total, titulo=None, sub=None):
    logo = Image.open(LOGO).convert("RGBA")
    h = 54
    logo = logo.resize((int(logo.width * h / logo.height), h))
    im.paste(logo, (70, 62), logo)
    d.text((W - 70, 78), f"{n:02d} / {total:02d}", font=f(26), fill=MUTED, anchor="ra")
    if titulo:
        y = paragrafo(d, 70, 190, titulo, f(66, True), TXT, W - 140, 1.15)
        if sub:
            y = paragrafo(d, 70, y + 14, sub, f(32), MUTED, W - 140)
        return y
    return 190


def rodape(d, texto="Gestão de Acidentalidade · CGB Energia", seta=True):
    d.line((70, H - 110, W - 70, H - 110), fill=LINE, width=2)
    d.text((70, H - 80), texto, font=f(26), fill=MUTED)
    if seta:
        d.text((W - 70, H - 80), "deslize ›", font=f(26, True), fill=ROSA, anchor="ra")


def cartao(d, caixa, raio=26, cor=SURF):
    d.rounded_rectangle(caixa, radius=raio, fill=cor, outline=LINE, width=2)


def barras(d, caixa, valores, cor=ROSA, meta=None, rotulos=None, maximo=None):
    x0, y0, x1, y1 = caixa
    maximo = maximo or max(valores) * 1.15
    n = len(valores)
    gap = 14
    bw = (x1 - x0 - gap * (n - 1)) / n
    base = y1 - 34
    alt = base - y0
    for i, v in enumerate(valores):
        x = x0 + i * (bw + gap)
        top = base - alt * v / maximo
        d.rounded_rectangle((x, top, x + bw, base), radius=10, fill=cor)
        if rotulos:
            d.text((x + bw / 2, base + 8), rotulos[i], font=f(20), fill=MUTED, anchor="ma")
    if meta is not None:
        y = base - alt * meta / maximo
        for x in range(int(x0), int(x1), 22):
            d.line((x, y, x + 11, y), fill=TXT, width=3)
        d.text((x1, y - 34), "meta", font=f(22, True), fill=TXT, anchor="ra")


def selo(d, x, y, texto, cor=ROSA):
    larg = d.textlength(texto, font=f(26, True)) + 44
    d.rounded_rectangle((x, y, x + larg, y + 54), radius=27, fill=None, outline=cor, width=3)
    d.text((x + 22, y + 10), texto, font=f(26, True), fill=cor)
    return x + larg + 14


slides = []


def capa():
    im, d = novo()
    logo = Image.open(LOGO).convert("RGBA")
    h = 90
    logo = logo.resize((int(logo.width * h / logo.height), h))
    im.paste(logo, (70, 90), logo)
    selo(d, 70, 330, "NOVO SISTEMA")
    y = paragrafo(d, 70, 430, "Gestão de Acidentalidade", f(104, True), TXT, W - 140, 1.08)
    y = paragrafo(d, 70, y + 24, "Todos os eventos acidentais da CGB reunidos em um só lugar, atualizados e ao alcance de qualquer aparelho.", f(38), MUTED, W - 160)
    # mini gráfico decorativo
    barras(d, (70, 960, W - 70, 1210), [5, 7, 4, 8, 6, 9, 5, 7, 3, 4], rotulos=None)
    d.text((70, H - 80), "Deslize para conhecer", font=f(30, True), fill=ROSA)
    d.text((W - 70, H - 80), "›", font=f(44, True), fill=ROSA, anchor="ra")
    slides.append(im)


def por_que():
    im, d = novo()
    y = cabecalho(im, d, 2, TOTAL, "Por que um novo sistema?")
    itens = [
        ("Informação única", "Chega de planilhas soltas: todos os registros no mesmo banco de dados."),
        ("Sempre atualizado", "Cada novo evento aparece para todos assim que é registrado."),
        ("Decisão mais rápida", "Indicadores, taxas e tendências prontos, sem montar relatório à mão."),
        ("Acesso de qualquer lugar", "Funciona no computador, tablet e celular."),
    ]
    y += 40
    for t, s in itens:
        cartao(d, (70, y, W - 70, y + 200))
        d.ellipse((100, y + 32, 150, y + 82), fill=VINHO)
        d.text((125, y + 57), "✓", font=f(30, True), fill=TXT, anchor="mm")
        d.text((180, y + 26), t, font=f(38, True), fill=TXT)
        paragrafo(d, 180, y + 82, s, f(28), MUTED, W - 290, 1.3)
        y += 226
    rodape(d)
    slides.append(im)


def painel():
    im, d = novo()
    y = cabecalho(im, d, 3, TOTAL, "Painel de eventos acidentais", "A visão geral da operação em uma única tela.")
    y += 30
    kpis = [("Total de eventos", "59"), ("Sem afastamento", "54"), ("Com afastamento", "2"), ("Dias sem afastamento", "99")]
    for i, (t, v) in enumerate(kpis):
        x = 70 + (i % 2) * 480
        yy = y + (i // 2) * 190
        destaque = i == 3
        cartao(d, (x, yy, x + 460, yy + 170), cor=VINHO if destaque else SURF)
        d.text((x + 28, yy + 22), t, font=f(26), fill=(255, 220, 228) if destaque else MUTED)
        d.text((x + 28, yy + 62), v, font=f(78, True), fill=TXT)
    y += 400
    cartao(d, (70, y, W - 70, y + 380))
    d.text((100, y + 26), "Histórico de eventos por mês", font=f(30, True), fill=TXT)
    barras(d, (110, y + 100, W - 110, y + 350), [6, 6, 5, 6, 5, 4, 9, 5, 9, 4], rotulos=["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out"])
    d.text((70, H - 175), "Turno, dia da semana, gerência, base, equipe e tipologia.", font=f(28), fill=MUTED)
    rodape(d)
    slides.append(im)


def taxas():
    im, d = novo()
    y = cabecalho(im, d, 4, TOTAL, "Taxas de frequência e gravidade", "Calculadas pela NBR 14280, com a meta em destaque.")
    y += 30
    for nome, vals, meta in [
        ("TFCA · frequência com afastamento", [3, 0, 5, 4, 1, 6, 2, 3], 3.5),
        ("TF · frequência sem afastamento", [8, 6, 10, 7, 9, 12, 8, 7], 9),
        ("TG · gravidade", [20, 0, 40, 10, 5, 60, 15, 8], 30),
    ]:
        cartao(d, (70, y, W - 70, y + 236))
        d.text((100, y + 22), nome, font=f(28, True), fill=TXT)
        barras(d, (110, y + 70, W - 110, y + 220), vals, meta=meta)
        y += 254
    rodape(d, "Acumulado ou mensal · gráficos ilustrativos")
    slides.append(im)


def comparativo():
    im, d = novo()
    y = cabecalho(im, d, 5, TOTAL, "Comparativo entre anos", "Veja se estamos melhorando: ano contra ano, mês a mês.")
    y += 40
    cartao(d, (70, y, W - 70, y + 620))
    x0, y0, x1, y1 = 120, y + 70, W - 120, y + 570
    a = [6, 6, 5, 6, 5, 4]
    b = [9, 5, 7, 4, 8, 6]
    n = len(a)
    gw = (x1 - x0) / n
    base = y1 - 30
    for i in range(n):
        gx = x0 + i * gw + 12
        for j, (v, cor) in enumerate([(a[i], ROSA2), (b[i], VINHO)]):
            top = base - (base - y0) * v / 10
            d.rounded_rectangle((gx + j * 62, top, gx + j * 62 + 52, base), radius=10, fill=cor)
        d.text((gx + 57, base + 8), ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"][i], font=f(22), fill=MUTED, anchor="ma")
    d.rounded_rectangle((120, y + 24, 144, y + 48), radius=6, fill=ROSA2)
    d.text((156, y + 18), "Ano anterior", font=f(24), fill=MUTED)
    d.rounded_rectangle((360, y + 24, 384, y + 48), radius=6, fill=VINHO)
    d.text((396, y + 18), "Ano atual", font=f(24), fill=MUTED)
    d.text((70, y + 660), "Gráfico ilustrativo.", font=f(24), fill=MUTED)
    rodape(d)
    slides.append(im)


def filtros():
    im, d = novo()
    y = cabecalho(im, d, 6, TOTAL, "Encontre exatamente o que procura", "Filtros que valem para todos os gráficos ao mesmo tempo.")
    y += 40
    grupos = [
        ("Ano e mês", ["2026", "Jan", "Fev", "Mar", "Abr"]),
        ("Base", ["BCB", "BDC", "PDS", "PDT", "ITM", "STI"]),
        ("Gerência", ["GOMAN", "GSTC", "GERE", "ADM", "LOG"]),
        ("Coordenador e gerente", ["Coordenador", "Gerente"]),
        ("Equipe e colaborador", ["Prefixo", "Nome"]),
    ]
    for t, chips in grupos:
        d.text((70, y), t, font=f(30, True), fill=TXT)
        x, yy = 70, y + 52
        for c in chips:
            larg = d.textlength(c, font=f(26)) + 40
            d.rounded_rectangle((x, yy, x + larg, yy + 50), radius=25, fill=SURF, outline=LINE, width=2)
            d.text((x + 20, yy + 8), c, font=f(26), fill=TXT)
            x += larg + 12
        y += 138
    d.text((70, y + 10), "Clique em qualquer barra ou fatia do gráfico para filtrar também.", font=f(28), fill=MUTED)
    rodape(d)
    slides.append(im)


def fotografia():
    im, d = novo()
    y = cabecalho(im, d, 7, TOTAL, "Fotografia para apresentações", "O painel completo em 16:9, pronto para o PowerPoint.")
    y += 50
    cartao(d, (70, y, W - 70, y + 560), raio=18)
    sw = W - 140
    # miniatura de painel
    for i in range(6):
        cx = 100 + i * ((sw - 60) / 6)
        d.rounded_rectangle((cx, y + 30, cx + (sw - 60) / 6 - 12, y + 110), radius=10, fill=VINHO if i == 5 else (40, 36, 44))
    d.rounded_rectangle((100, y + 130, 100 + 520, y + 330), radius=12, fill=(40, 36, 44))
    barras(d, (120, y + 150, 600, y + 320), [6, 6, 5, 6, 5, 4, 9, 5, 9, 4])
    d.rounded_rectangle((640, y + 130, 980, y + 330), radius=12, fill=(40, 36, 44))
    d.ellipse((730, y + 150, 890, y + 310), outline=ROSA, width=26)
    for i in range(3):
        d.rounded_rectangle((100 + i * 290, y + 350, 100 + i * 290 + 270, y + 530), radius=12, fill=(40, 36, 44))
    itens = ["Baixe em PNG (1920 × 1080)", "Por base, por gerência ou por coordenador", "Baixe todas as imagens de uma vez"]
    yy = y + 610
    for t in itens:
        d.ellipse((74, yy + 8, 106, yy + 40), fill=ROSA)
        d.text((126, yy), t, font=f(32), fill=TXT)
        yy += 62
    rodape(d)
    slides.append(im)


def acesso():
    im, d = novo()
    y = cabecalho(im, d, 8, TOTAL, "Como acessar")
    y += 40
    passos = [
        ("1", "Abra no navegador", "gestao-de-acidentalidade.vercel.app"),
        ("2", "Entre com seu usuário e senha", "Enviados pela equipe de Qualidade e SMS."),
        ("3", "Troque a senha no primeiro acesso", "Sua senha é pessoal, não compartilhe."),
        ("4", "Consulte à vontade", "Painel, taxas e comparativo, em qualquer aparelho."),
    ]
    for n, t, s in passos:
        cartao(d, (70, y, W - 70, y + 190))
        d.ellipse((100, y + 50, 190, y + 140), fill=VINHO)
        d.text((145, y + 94), n, font=f(48, True), fill=TXT, anchor="mm")
        d.text((225, y + 36), t, font=f(36, True), fill=TXT)
        paragrafo(d, 225, y + 96, s, f(28), ROSA2 if n == "1" else MUTED, W - 330, 1.3)
        y += 214
    d.text((70, y + 30), "Dúvidas ou problemas de acesso? Fale com a equipe de Qualidade e SMS.", font=f(28), fill=MUTED)
    rodape(d, "Desenvolvido por Marcus Vinicius Silva Queiros", seta=False)
    slides.append(im)


TOTAL = 8
for fn in (capa, por_que, painel, taxas, comparativo, filtros, fotografia, acesso):
    fn()
for i, im in enumerate(slides, 1):
    im.save(os.path.join(SAIDA, f"slide-{i:02d}.png"))
print(f"{len(slides)} slides em {SAIDA}")
