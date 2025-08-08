# ClickCmds — Botões para Comandos

Extensão que lê `.cmmds` (YAML) no workspace e exibe botões para cada comando. Você clica e ele roda no terminal atual ou em terminal oculto. Permite overrides temporários salvos em `temporary` no próprio `.cmmds`.

## Arquivo .cmmds

Exemplo:

```yaml
settings:
  runInCurrentTerminal: true
commands:
  build: npm run build
  test: npm test
  deploy: echo "Deploy"
temporary:
  settings:
    runInCurrentTerminal: false
  commands:
    test: npm test -- -u
```

- settings.runInCurrentTerminal: usa o terminal ativo quando true; caso contrário cria terminal oculto.
- temporary.*: overrides temporários feitos pela UI (botão “👁”).

## Comandos

- ClickCmds: Abrir .cmmds
- ClickCmds: Recarregar

## Como executar em desenvolvimento

- Pressione F5 para iniciar a Extension Development Host.
- Abra a view “ClickCmds” na barra lateral.

## Requisitos

- VS Code 1.102+

## Licença

MIT
