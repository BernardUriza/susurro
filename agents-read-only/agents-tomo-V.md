# 📕 AGENTS – TOMO V  
## 🚨 AUTOMATIZACIÓN BRUTAL: CI/CD, REPOS Y PIPELINES SIN PIEDAD

---

## 🎯 PROPÓSITO DEL TOMO

No importa si tu código brilla localmente:  
**Si no sobrevive un pipeline, es basura.**  

Este tomo detalla cómo:

- Convertir tu repo en una **trinchera automatizada**
- Configurar un CI/CD que **grita si algo huele mal**
- Mantener un `main` que es **territorio sagrado**

---

## 🏗️ ESTRUCTURA DE REPO IMPLACABLE

```plaintext
root/
├── src/               # Solo lógica limpia
├── tests/             # Cobertura total
├── scripts/           # Automatización brutal
├── public/            # Archivos estáticos
├── .github/           # Workflows de CI/CD
├── .husky/            # Hooks brutales
├── .vscode/           # Config de equipo, no personal
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── quality-check.sh   # Auditoría brutal pre-push
````

---

## 🤖 CI/CD COMO CÁMARA DE TORTURA

### `main` es sagrado. `dev` es tu purgatorio.

### CI checks obligatorios antes de mergear:

* ✅ Linting
* ✅ Tests (unit + E2E)
* ✅ Coverage ≥ 90%
* ✅ Mutation ≥ 70%
* ✅ Complexidad < 10
* ✅ Limpieza de archivos temporales
* ✅ Revisión de IA: rechazo si > 80% sin cambios

### Ejemplo de workflow (`.github/workflows/quality.yml`)

```yaml
name: Brutal CI

on: [push, pull_request]

jobs:
  brutal-check:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - uses: pnpm/action-setup@v2

    - name: Instalar dependencias
      run: pnpm install

    - name: Linting
      run: pnpm lint

    - name: Tests
      run: pnpm test

    - name: Coverage Check
      run: pnpm coverage && cat coverage/summary.txt

    - name: Mutation Testing
      run: npx stryker run

    - name: Quality Gate
      run: bash ./quality-check.sh
```

---

## 🛡️ HUSKY Y GANCHOS PRECOMMIT

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🛡️ Validando calidad antes de cometer basura..."
pnpm lint && pnpm test --changed && bash quality-check.sh
```

**Violación = Commit bloqueado.**
Así se entrena la excelencia.

---

## 🧪 quality-check.sh – TU JUEZ, JURADO Y VERDUGO

```bash
#!/bin/bash
echo "🧪 CHECK DE CALIDAD INICIADO..."

COV=$(cat coverage/summary.txt | grep "All files" | awk '{print $4}' | tr -d '%')
if (( $(echo "$COV < 90" | bc -l) )); then
  echo "❌ Coverage muy bajo: $COV%"
  exit 1
fi

MUT=$(npx stryker score | grep "mutation score" | awk '{print $3}' | tr -d '%')
if (( $(echo "$MUT < 70" | bc -l) )); then
  echo "❌ Mutation Score insuficiente: $MUT%"
  exit 1
fi

echo "✅ Calidad aceptable. Puedes proceder."
```

---

## 🔥 GUERRA CONTRA LA BASURA EN LA HISTORIA

```bash
# .gitignore
node_modules/
coverage/
dist/
debug-*
*.log
.vscode/*
```

**Regla:** Tu `main` debe ser legible como un poema y sagrado como tu sangre.

---

## 💀 REPOSITORIOS SIN ALMA (ANTIPATRONES)

| Síntoma                   | Diagnóstico             | Solución                             |
| ------------------------- | ----------------------- | ------------------------------------ |
| `main` con commits rotos  | Eres un amateur         | Usa `dev` + CI                       |
| Commits sin mensaje claro | Nadie sabrá qué hiciste | Convention: `feat:`, `fix:`, `test:` |
| 2000 líneas de PR         | Codificaste sin pensar  | Divide y conquista                   |
| `.env` público            | Expones todo            | `.env` → `.gitignore`                |
| Cambios sin test          | Esperas suerte          | Regla: "sin test, no commit"         |

---

## 🛑 PROTOCOLO DE STOP - CI COMO GUARDIÁN

CI DEBE BLOQUEAR si:

* [ ] Coverage < 90%
* [ ] Mutation < 70%
* [ ] Test falla
* [ ] Linter falla
* [ ] Logs muestran `console.error` sin test asociado
* [ ] IA generó código > 20 líneas sin revisión
* [ ] Tests E2E no simulan usuario real

---

## 🔁 VERSIONADO Y TAGGING COMO GUERRILLA

```bash
# Semantic commit messages
feat(audio): mejora en análisis VAD
fix(vad): corrige edge case de silencio
refactor(cleanup): reduce uso de RAM
test(processor): añade casos límite
```

```bash
# Tagging real
git tag -a v2.1.0 -m "Versión brutal con VAD mejorado y CI reforzado"
```

---

## 🧠 MONITOREO CONTINUO Y METRICS BOARD

Ejecuta scripts como cron o al deploy:

* `coverage.sh` → Exporta a Grafana
* `mutation-report.json` → Mail diario
* `performance.log` → Alerta si >3s
* `token-usage.log` → Detecta fugas IA

---

## 🧨 MANTENIMIENTO PROGRAMADO

### Cada semana:

* [ ] Revisión de dependencias
* [ ] Auditoría de tests (mutants vivos)
* [ ] Limpieza de ramas obsoletas
* [ ] Push de métricas a board de calidad

---

## 📋 CHECKLIST FINAL DE CI/CD

* [ ] CI bloquea todo lo que debe
* [ ] quality-check.sh cubre métricas vitales
* [ ] Scripts de limpieza corren siempre
* [ ] Commits siguen convención
* [ ] PRs son pequeños, claros y probados
* [ ] No hay secretos en el repo
* [ ] Cada deploy queda registrado y medido

---

## 🔥 CONCLUSIÓN DEL TOMO V

> “Un código no vale por lo que hace en tu máquina,
> sino por lo que sobrevive en el infierno de la automatización.”

CI/CD no es opcional. Es la muralla entre tú y la mediocridad.

---

## 🏁 CONCLUSIÓN DE LA SAGA: `AGENTS.MD`

Has llegado al final del camino...
…o al **inicio del estándar que nadie quiere, pero todos necesitan.**

Si aplicas los 5 tomos:

* Tu código será impenetrable
* Tu repo será una fortaleza
* Tu nombre en git será sinónimo de calidad

**Y si no…**
Volverás al infierno del "Funciona en mi máquina"
…y ahí te quedarás.

---

🩸 Firmado en CI pipelines y ramas protegidas,
**THE ULTIMATE BRUTAL QUALITY ENFORCER**

```

---

¿Quieres que lo compile todo en un solo archivo `.md` o los empaquemos en un `.zip` listos para producción?
```