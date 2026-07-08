## Diagnóstico do erro no Roberto Rocha

O problema não está no cadastro do condomínio: ele está salvo com **60 unidades** e categoria **prédio**.

O erro vem da etapa de interpretação da convenção. O texto extraído contém estas informações relevantes:

- “composto de um bloco, contendo **60 (sessenta) unidades autônomas**”
- “**15 (quinze) pavimentos tipo**, sendo em cada pavimento **04 unidades autônomas**”
- “Pavimento Especial: localiza-se no **18º andar**, sendo composto de piscina, sauna, sala de festas, sala de ginástica etc.”

A IA gerou unidades de **101 a 1804**, ou seja:

```text
18 andares x 4 apartamentos = 72 unidades
```

Mas a leitura correta é:

```text
15 pavimentos tipo x 4 apartamentos = 60 unidades
```

O “18º andar” mencionado no documento é **pavimento especial / área comum**, não pavimento tipo residencial. A IA confundiu o número ordinal “18º andar” com mais pavimentos residenciais e extrapolou apartamentos inexistentes nos andares 16, 17 e 18.

Também há um segundo fator: a lista OCR da convenção está truncada/parcial, com unidades visíveis até 1504 em um trecho e continuação ruim em outro. Quando a lista real fica incompleta, o prompt atual permite a IA “gerar numericamente” unidades — e ela usou a referência errada: 18 andares em vez de 15 pavimentos tipo.

## Possíveis soluções

### Solução 1 — Só reforçar o prompt da IA

Ajustar o prompt para dizer que pavimentos especiais, cobertura, garagem, subsolo e áreas comuns não geram unidades.

**Vantagem:** simples.

**Limite:** ainda depende da IA obedecer sempre. Como já vimos, mesmo com regra de “60 nunca 72”, ela ignorou a contagem quando viu “18º andar”.

### Solução 2 — Pós-validação determinística no servidor

Depois da IA responder, o sistema valida o resultado com regras objetivas:

- se o cadastro/convenção declara `qtd_unidades = 60`, a sugestão não pode retornar 72;
- para prédio, detectar padrão de apartamentos por andar (`101`, `102`, `103`, `104` etc.);
- se houver excesso, remover os andares acima do total compatível com a contagem declarada;
- no caso Roberto Rocha: manter `101–1504` e remover `1601–1804`.

**Vantagem:** corrige o erro mesmo se a IA insistir em gerar 72.

**Limite:** precisa ser cuidadoso para não cortar unidades reais em condomínios com cobertura/unidades especiais. Por isso deve só agir quando houver padrão claro e total declarado.

### Solução 3 — Extração híbrida: regras antes da IA

Antes de perguntar à IA, o servidor tenta interpretar frases formais como:

```text
15 pavimentos tipo, 04 unidades por pavimento
60 unidades autônomas
```

Quando houver esse padrão, o sistema já gera a lista correta de unidades (`101–1504`) e usa a IA só para complementar área/fração, não para decidir a quantidade.

**Vantagem:** mais preciso para convenções padronizadas.

**Limite:** mais trabalho e cobre primeiro os padrões mais comuns; ainda mantém IA como fallback.

## Plano recomendado

Implementar uma correção proporcional, sem over-engineering, combinando as soluções 1 e 2:

1. **Reforçar o prompt** em `src/lib/unidades-ia.functions.ts` para impedir que “pavimento especial”, “cobertura”, “subsolo”, “térreo” e áreas comuns sejam convertidos em unidades autônomas.
2. **Adicionar pós-validação determinística** após a deduplicação das unidades:
   - usar `qtd_unidades` como limite forte quando for maior que zero;
   - detectar padrão de prédio com apartamentos por andar;
   - quando a IA retornar mais unidades que o total previsto e o excesso estiver em andares finais gerados artificialmente, cortar para o total correto;
   - preservar dados de área/fração/vagas das unidades mantidas.
3. **Adicionar metadados de auditoria na sugestão**, para a UI poder explicar quando houve correção automática, por exemplo: “A IA retornou 72 unidades, mas a convenção/cadastro prevê 60; foram removidas 12 unidades geradas em pavimento especial/cobertura.”
4. **Reprocessar a sugestão pendente do Roberto Rocha** para substituir a sugestão atual de 72 pela lista correta de 60 unidades.
5. **Validar no banco** que a nova sugestão pendente possui exatamente 60 unidades e que não há apartamentos `1601–1804`.

## Resultado esperado

No Roberto Rocha, a revisão/importação passará a mostrar **60 apartamentos**, numerados de `101` a `1504`, respeitando os 15 pavimentos tipo com 4 unidades por pavimento e ignorando o pavimento especial do 18º andar.