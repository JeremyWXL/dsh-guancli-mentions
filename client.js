window.__ModuleLoader__.load({
  id: '@local/dsh-guancli-mentions',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'guancli-mentions'
    /** RPC route served by the Host half. */
    const ROUTE = '/guancli-mentions/v1/rpc'
    /** Evidence-panel text: the source name must match `insert.source`. */
    const SOURCE = 'guancli'

    /** Simplified Chinese copy (key-set source of truth). */
    const zh = {
      'section.datasets': '观远数据集',
      'section.pages': '观远看板',
      'section.status': '观远数据',
      'hint.needQuery': '输入关键词搜索观远资产（环境：{env}）',
      'hint.needQuery.description': '切换环境用 @环境名/关键词；已鉴权：{envs}',
      'hint.noMatch': '「{keyword}」在 {env} 没有匹配的数据集或看板',
      'hint.noMatch.description': '换个关键词，或切到其它环境：@环境名/关键词',
      'hint.noEnvironment': 'guancli 还没有已鉴权的 BI 环境',
      'hint.noEnvironment.description': '先执行 guancli auth login 再回来使用 @',
      'hint.noCli': '未找到或无法调用 guancli',
      'hint.noCli.description': '确认 guancli 已安装并可从该用户执行',
      'hint.noGateway': '观远插件未启用，无法搜索资产',
      'hint.noGateway.description': '需安装 @guandata/dsh-guancli 以复用资产检索',
      'hint.error': '观远资产搜索失败',
      'hint.error.description': '稍后重试；若持续失败请检查 BI 连接状态',
      'hint.unknownEnvironment': '环境 {env} 未在 guancli 鉴权',
      'hint.restart': '观远插件需要重启 DSH Desktop 后生效',
      'hint.restart.description': '新版 Host 模块要重启才能加载，重启后刷新页面再试',
    }
    const en = {
      'section.datasets': 'Guandata datasets',
      'section.pages': 'Guandata dashboards',
      'section.status': 'Guandata',
      'hint.needQuery': 'Type a keyword to search Guandata assets (environment: {env})',
      'hint.needQuery.description': 'Switch environment with @env/keyword; authenticated: {envs}',
      'hint.noMatch': 'No dataset or dashboard matches "{keyword}" in {env}',
      'hint.noMatch.description': 'Try another keyword, or another environment: @env/keyword',
      'hint.noEnvironment': 'guancli has no authenticated BI environment',
      'hint.noEnvironment.description': 'Run guancli auth login, then use @ again',
      'hint.noCli': 'guancli is missing or not callable',
      'hint.noCli.description': 'Check that guancli is installed and runnable for this user',
      'hint.noGateway': 'The Guandata plugin is disabled, so assets cannot be searched',
      'hint.noGateway.description': 'Install @guandata/dsh-guancli to reuse its asset discovery',
      'hint.error': 'Guandata asset search failed',
      'hint.error.description': 'Retry later; if it persists, check the BI connection',
      'hint.unknownEnvironment': 'Environment {env} is not authenticated in guancli',
      'hint.restart': 'The Guandata plugin needs a DSH Desktop restart',
      'hint.restart.description': 'The new Host module loads only after restart; restart, reload the page, then retry',
    }
    const ja = {
      'section.datasets': 'Guandata データセット',
      'section.pages': 'Guandata ダッシュボード',
      'section.status': 'Guandata',
      'hint.needQuery': 'キーワードで Guandata アセットを検索（環境：{env}）',
      'hint.needQuery.description': '環境の切り替えは @環境名/キーワード。認証済み：{envs}',
      'hint.noMatch': '「{keyword}」に一致するデータセットやダッシュボードは {env} にありません',
      'hint.noMatch.description': '別のキーワードか、@環境名/キーワードで環境を切り替えてください',
      'hint.noEnvironment': 'guancli に認証済みの BI 環境がありません',
      'hint.noEnvironment.description': 'guancli auth login を実行してから @ を使ってください',
      'hint.noCli': 'guancli が見つからないか実行できません',
      'hint.noCli.description': 'guancli がインストールされ実行可能か確認してください',
      'hint.noGateway': 'Guandata プラグインが無効のためアセットを検索できません',
      'hint.noGateway.description': '@guandata/dsh-guancli をインストールしてください',
      'hint.error': 'Guandata アセットの検索に失敗しました',
      'hint.error.description': '後で再試行してください。続く場合は BI 接続を確認してください',
      'hint.unknownEnvironment': '環境 {env} は guancli で認証されていません',
      'hint.restart': 'Guandata プラグインは DSH Desktop の再起動後に有効になります',
      'hint.restart.description': '新しい Host モジュールは再起動時に読み込まれます。再起動して再読み込みしてください',
    }
    const es = {
      'section.datasets': 'Conjuntos de datos de Guandata',
      'section.pages': 'Paneles de Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Escriba una palabra clave para buscar activos (entorno: {env})',
      'hint.needQuery.description': 'Cambie de entorno con @entorno/palabra; autenticados: {envs}',
      'hint.noMatch': 'Ningún conjunto de datos o panel coincide con "{keyword}" en {env}',
      'hint.noMatch.description': 'Pruebe otra palabra o entorno: @entorno/palabra',
      'hint.noEnvironment': 'guancli no tiene ningún entorno BI autenticado',
      'hint.noEnvironment.description': 'Ejecute guancli auth login y vuelva a usar @',
      'hint.noCli': 'guancli no está instalado o no se puede ejecutar',
      'hint.noCli.description': 'Compruebe que guancli esté instalado y disponible',
      'hint.noGateway': 'El plugin de Guandata está desactivado; no se pueden buscar activos',
      'hint.noGateway.description': 'Instale @guandata/dsh-guancli para reutilizar su descubrimiento',
      'hint.error': 'Falló la búsqueda de activos de Guandata',
      'hint.error.description': 'Reintente más tarde; si persiste, revise la conexión BI',
      'hint.unknownEnvironment': 'El entorno {env} no está autenticado en guancli',
      'hint.restart': 'El plugin de Guandata requiere reiniciar DSH Desktop',
      'hint.restart.description': 'El nuevo módulo Host solo se carga al reiniciar; reinicie, recargue y reintente',
    }
    const fr = {
      'section.datasets': 'Jeux de données Guandata',
      'section.pages': 'Tableaux de bord Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Saisissez un mot-clé pour chercher des actifs (environnement : {env})',
      'hint.needQuery.description': "Changez d'environnement avec @env/mot-clé ; authentifiés : {envs}",
      'hint.noMatch': 'Aucun jeu de données ni tableau de bord ne correspond à « {keyword} » dans {env}',
      'hint.noMatch.description': 'Essayez un autre mot-clé ou environnement : @env/mot-clé',
      'hint.noEnvironment': "guancli n'a aucun environnement BI authentifié",
      'hint.noEnvironment.description': 'Lancez guancli auth login puis réutilisez @',
      'hint.noCli': 'guancli est absent ou non exécutable',
      'hint.noCli.description': 'Vérifiez que guancli est installé et exécutable',
      'hint.noGateway': 'Le plugin Guandata est désactivé ; recherche impossible',
      'hint.noGateway.description': 'Installez @guandata/dsh-guancli pour réutiliser sa découverte',
      'hint.error': 'Échec de la recherche d’actifs Guandata',
      'hint.error.description': 'Réessayez plus tard ; vérifiez la connexion BI si cela persiste',
      'hint.unknownEnvironment': "L'environnement {env} n'est pas authentifié dans guancli",
      'hint.restart': 'Le plugin Guandata nécessite un redémarrage de DSH Desktop',
      'hint.restart.description': 'Le nouveau module Host ne se charge qu’au redémarrage ; redémarrez, rechargez puis réessayez',
    }
    const de = {
      'section.datasets': 'Guandata-Datensätze',
      'section.pages': 'Guandata-Dashboards',
      'section.status': 'Guandata',
      'hint.needQuery': 'Suchbegriff eingeben, um Guandata-Assets zu finden (Umgebung: {env})',
      'hint.needQuery.description': 'Umgebung wechseln mit @umgebung/suchbegriff; authentifiziert: {envs}',
      'hint.noMatch': 'Kein Datensatz und kein Dashboard passt zu „{keyword}“ in {env}',
      'hint.noMatch.description': 'Anderen Suchbegriff oder @umgebung/suchbegriff versuchen',
      'hint.noEnvironment': 'guancli hat keine authentifizierte BI-Umgebung',
      'hint.noEnvironment.description': 'Führen Sie guancli auth login aus und nutzen Sie @ erneut',
      'hint.noCli': 'guancli fehlt oder ist nicht ausführbar',
      'hint.noCli.description': 'Prüfen Sie, ob guancli installiert und ausführbar ist',
      'hint.noGateway': 'Das Guandata-Plugin ist deaktiviert; Assets nicht durchsuchbar',
      'hint.noGateway.description': 'Installieren Sie @guandata/dsh-guancli',
      'hint.error': 'Guandata-Assetsuche fehlgeschlagen',
      'hint.error.description': 'Später erneut versuchen; sonst BI-Verbindung prüfen',
      'hint.unknownEnvironment': 'Umgebung {env} ist in guancli nicht authentifiziert',
      'hint.restart': 'Das Guandata-Plugin benötigt einen DSH-Desktop-Neustart',
      'hint.restart.description': 'Das neue Host-Modul lädt erst nach dem Neustart; neu starten, Seite neu laden, erneut versuchen',
    }
    const ru = {
      'section.datasets': 'Наборы данных Guandata',
      'section.pages': 'Панели Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Введите запрос для поиска активов (среда: {env})',
      'hint.needQuery.description': 'Смена среды: @среда/запрос; авторизованы: {envs}',
      'hint.noMatch': 'В среде {env} нет набора данных или панели по запросу «{keyword}»',
      'hint.noMatch.description': 'Попробуйте другой запрос или @среда/запрос',
      'hint.noEnvironment': 'В guancli нет авторизованной среды BI',
      'hint.noEnvironment.description': 'Выполните guancli auth login и снова используйте @',
      'hint.noCli': 'guancli не найден или не запускается',
      'hint.noCli.description': 'Проверьте, что guancli установлен и доступен',
      'hint.noGateway': 'Плагин Guandata отключён, поиск активов недоступен',
      'hint.noGateway.description': 'Установите @guandata/dsh-guancli',
      'hint.error': 'Не удалось выполнить поиск активов Guandata',
      'hint.error.description': 'Повторите позже; проверьте подключение к BI',
      'hint.unknownEnvironment': 'Среда {env} не авторизована в guancli',
      'hint.restart': 'Плагину Guandata нужен перезапуск DSH Desktop',
      'hint.restart.description': 'Новый модуль Host загружается только после перезапуска; перезапустите и повторите',
    }
    const pt = {
      'section.datasets': 'Conjuntos de dados Guandata',
      'section.pages': 'Painéis Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Digite uma palavra-chave para buscar ativos (ambiente: {env})',
      'hint.needQuery.description': 'Troque de ambiente com @ambiente/palavra; autenticados: {envs}',
      'hint.noMatch': 'Nenhum conjunto de dados ou painel corresponde a "{keyword}" em {env}',
      'hint.noMatch.description': 'Tente outra palavra ou ambiente: @ambiente/palavra',
      'hint.noEnvironment': 'O guancli não tem ambiente BI autenticado',
      'hint.noEnvironment.description': 'Execute guancli auth login e use @ novamente',
      'hint.noCli': 'guancli ausente ou não executável',
      'hint.noCli.description': 'Verifique se o guancli está instalado e disponível',
      'hint.noGateway': 'O plugin Guandata está desativado; busca indisponível',
      'hint.noGateway.description': 'Instale @guandata/dsh-guancli',
      'hint.error': 'Falha na busca de ativos Guandata',
      'hint.error.description': 'Tente mais tarde; verifique a conexão BI',
      'hint.unknownEnvironment': 'O ambiente {env} não está autenticado no guancli',
      'hint.restart': 'O plugin Guandata requer reiniciar o DSH Desktop',
      'hint.restart.description': 'O novo módulo Host só carrega após reiniciar; reinicie, recarregue e tente de novo',
    }

    /**
     * Strip characters that would break the Markdown mention form or the draft
     * span validation. Must agree with the Host-side sanitizer.
     * @param value - raw asset name.
     * @returns a single-line label.
     */
    function sanitizeLabel(value) {
      const collapsed = String(value == null ? '' : value)
        .replace(/[[\]()\n\r\t]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
      return Array.from(collapsed).slice(0, 60).join('').trim()
    }

    /**
     * Call the Host mention RPC.
     * @param action - action name.
     * @param input - action input.
     * @param signal - candidate-fetch cancellation.
     * @returns `{ data }`, `{ error }`, or `{ aborted: true }`.
     */
    async function rpc(action, input, signal) {
      let response
      try {
        response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, input }),
          signal,
        })
      } catch (error) {
        if (error && error.name === 'AbortError') return { aborted: true }
        console.warn('[guancli-mentions] rpc unavailable:', error)
        return { error: 'unreachable' }
      }
      let body
      try {
        body = await response.json()
      } catch {
        return { error: 'invalid response' }
      }
      if (!body || body.ok !== true) {
        console.warn('[guancli-mentions] rpc failed:', body && body.error)
        return { error: (body && body.error && body.error.message) || 'rpc failed' }
      }
      return { data: body.data }
    }

    /** Datasets icon: stacked rows, matching the BI dataset glyph. */
    function DatasetIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('ellipse', { cx: 12, cy: 6, rx: 7, ry: 3, key: 'top' }),
        h('path', { d: 'M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6', key: 'body' }),
        h('path', { d: 'M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6', key: 'base' }),
      )
    }

    /** Dashboard icon: a framed page with two cards. */
    function PageIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2, key: 'frame' }),
        h('path', { d: 'M7 9h6v4H7z', key: 'card-a' }),
        h('path', { d: 'M16 9v4', key: 'card-b' }),
        h('path', { d: 'M7 16h10', key: 'axis' }),
      )
    }

    /** Status icon: a plain information ring used by explain-me rows. */
    function HintIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('circle', { cx: 12, cy: 12, r: 9, key: 'ring' }),
        h('path', { d: 'M12 11v5', key: 'stem' }),
        h('path', { d: 'M12 8h.01', key: 'dot' }),
      )
    }

    /** Cached result of the one-time Host capability probe. */
    let hostReady

    /** Lowest Host generation that serves environment-scoped candidates. */
    const MIN_HOST_VERSION = '0.2.0'

    /**
     * Compare dotted versions numerically: `version` >= `minimum`.
     * @param version - reported Host version.
     * @param minimum - lowest accepted version.
     * @returns whether the Host generation satisfies the floor.
     */
    function versionAtLeast(version, minimum) {
      const parse = (text) => String(text).split('.').map((part) => {
        const numeric = Number.parseInt(part, 10)
        return Number.isFinite(numeric) ? numeric : 0
      })
      const left = parse(version)
      const right = parse(minimum)
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const a = left[index] ?? 0
        const b = right[index] ?? 0
        if (a !== b) return a > b
      }
      return true
    }

    /**
     * The Host half must be the environment-scoped generation; a replaced
     * package keeps serving the previous module until the app restarts.
     * @returns whether the Host answered with an accepted generation.
     */
    async function ensureHost() {
      if (hostReady !== undefined) return hostReady
      const result = await rpc('health', {})
      // A probe that never reached the host says nothing about its generation;
      // the real call reports that failure with its own row.
      if (result.data === undefined) return true
      hostReady = typeof result.data.version === 'string' && versionAtLeast(result.data.version, MIN_HOST_VERSION)
      return hostReady
    }

    /**
     * Build the registered `@` source.
     * @param scope - context exposing `inputTriggers` and `locale`.
     * @returns one input-trigger source.
     */
    function createSource(scope) {
      const t = scope.locale.bind(NS)

      /**
       * Translate then substitute `{name}` placeholders.
       * @param key - locale key.
       * @param values - placeholder values.
       * @returns the rendered text.
       */
      function text(key, values = {}) {
        return String(t(key)).replace(/\{(\w+)\}/gu, (whole, name) => (
          Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole
        ))
      }

      /**
       * One explain-me row: picking it inserts nothing, it only explains why the
       * group is empty. Its presence also proves the Client half is loaded.
       * @param name - headline text.
       * @param description - what the user should do.
       * @returns a non-insertable candidate.
       */
      function hintRow(name, description) {
        return {
          name,
          ...(description === undefined ? {} : { description }),
          icon: HintIcon,
          section: t('section.status'),
          value: JSON.stringify({ kind: 'hint' }),
        }
      }

      /**
       * Explain one empty state.
       * @param data - the host candidate payload.
       * @param keyword - keyword the user typed.
       * @returns the row.
       */
      function explain(data, keyword) {
        const env = data.env || '—'
        const envs = Array.isArray(data.environments) && data.environments.length > 0
          ? data.environments.join(' / ')
          : '—'
        switch (data.state) {
          case 'need-query':
            return hintRow(text('hint.needQuery', { env }), text('hint.needQuery.description', { envs }))
          case 'no-match':
            return hintRow(text('hint.noMatch', { keyword, env }), t('hint.noMatch.description'))
          case 'unknown-environment':
            return hintRow(text('hint.unknownEnvironment', { env }), text('hint.needQuery.description', { envs }))
          case 'no-environment':
            return hintRow(t('hint.noEnvironment'), t('hint.noEnvironment.description'))
          case 'no-cli':
            return hintRow(t('hint.noCli'), t('hint.noCli.description'))
          case 'no-gateway':
            return hintRow(t('hint.noGateway'), t('hint.noGateway.description'))
          default:
            return hintRow(t('hint.error'), t('hint.error.description'))
        }
      }

      return {
        trigger: '@',
        name: SOURCE,
        order: -10,
        showGroupTitle: false,
        /**
         * The composer serializes every picked chip through its owning source's
         * codec before submit. Without one, sending fails with
         * `slash: no serializer for reference source "guancli"`.
         * `ref` is already the canonical mention the Host parses, so the model
         * form is the ref itself.
         */
        codec: {
          clipboardText: (ref) => ref,
          serialize: (ref) => Promise.resolve(ref),
        },
        async candidates(session, request) {
          if (request.quoted === true) return []
          const sessionId = String(session && session.sessionId ? session.sessionId : '')
          if (sessionId === '') return []
          if (!(await ensureHost())) return [hintRow(t('hint.restart'), t('hint.restart.description'))]
          const keyword = String(request.query || '')
          const result = await rpc('candidates', { sessionId, query: keyword }, request.signal)
          if (result.aborted) return []
          if (result.error !== undefined || result.data === undefined) {
            return [hintRow(t('hint.error'), t('hint.error.description'))]
          }
          const data = result.data
          const items = Array.isArray(data.items) ? data.items : []
          if (items.length === 0) return [explain(data, keyword)]
          return items.map((item) => {
            const label = sanitizeLabel(item.name) || String(item.id)
            const section = item.type === 'page' ? t('section.pages') : t('section.datasets')
            return {
              name: label,
              ...(item.path ? { description: `${item.env} · ${item.path}` } : { description: item.env }),
              icon: item.type === 'page' ? PageIcon : DatasetIcon,
              section,
              value: JSON.stringify({ type: item.type, id: String(item.id), name: label, env: item.env }),
            }
          })
        },
        onPick({ candidate }) {
          let value
          try {
            value = JSON.parse(candidate.value)
          } catch {
            return undefined
          }
          if (!value || value.kind === 'hint') return undefined
          if ((value.type !== 'dataset' && value.type !== 'page') || !value.id || !value.env) return undefined
          const label = sanitizeLabel(value.name) || String(value.id)
          const mention = `@[${label}](dsh-guancli:${value.type}:${value.env}:${value.id})`
          return {
            insert: {
              source: SOURCE,
              ref: mention,
              label,
              clipboardText: mention,
            },
          }
        },
      }
    }

    return {
      inject: ['locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
          'guancli-mentions: dictionaries',
        )
        ctx.inject(['inputTriggers', 'locale'], (scope) => {
          scope.effect(
            () => scope.inputTriggers.registerSource(createSource(scope)),
            'guancli-mentions: @ source',
          )
        })
      },
    }
  },
})
