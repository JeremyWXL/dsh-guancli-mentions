window.__ModuleLoader__.load({
  id: '@local/dsh-guancli-mentions',
  factory(require) {
    const React = require('react')
    const { Modal, Button } = require('@deepseek-ai/dsh-client-ui-primitives')
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
      'hint.error': '观远资产搜索失败',
      'hint.error.description': '稍后重试；若持续失败请检查 BI 连接状态',
      'hint.unknownEnvironment': '环境 {env} 未在 guancli 鉴权',
      'hint.restart': '观远插件需要重启 DSH Desktop 后生效',
      'hint.restart.description': '新版 Host 模块要重启才能加载，重启后刷新页面再试',
      'scope.title': '页面数据范围', 'scope.close': '关闭', 'scope.loading': '正在读取页面筛选器…',
      'scope.save': '保存数据范围', 'scope.saved': '已保存，Agent 将使用此数据范围',
      'scope.chip': '确认数据范围', 'scope.confirm': '确认范围并继续',
      'scope.restored': '原范围已失效，已加载当前页面筛选器，请重新确认',
      'scope.analysisLabel': '分析要求（可选）', 'scope.analysisPlaceholder': '例如：分析本月费用异常，并指出需要重点关注的业务单位',
      'scope.readOnly': '此筛选器暂不支持编辑', 'scope.noOptions': '没有可用枚举值', 'scope.all': '全部',
      'asset.menu': '看板操作：{name}', 'asset.adjust': '调整数据范围', 'asset.openPage': '打开页面',
      'asset.open': '在侧边栏打开 {name}',
      'asset.openFailed': '打开失败：{reason}',
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
      'hint.error': 'Guandata asset search failed',
      'hint.error.description': 'Retry later; if it persists, check the BI connection',
      'hint.unknownEnvironment': 'Environment {env} is not authenticated in guancli',
      'hint.restart': 'The Guandata plugin needs a DSH Desktop restart',
      'hint.restart.description': 'The new Host module loads only after restart; restart, reload the page, then retry',
      'scope.title': 'Page data scope', 'scope.close': 'Close', 'scope.loading': 'Loading page filters…',
      'scope.save': 'Save data scope', 'scope.saved': 'Saved. The agent will use this data scope',
      'scope.chip': 'Confirm data scope', 'scope.confirm': 'Confirm scope and continue',
      'scope.restored': 'The previous scope expired. Review the current page filters and confirm again',
      'scope.analysisLabel': 'Analysis request (optional)', 'scope.analysisPlaceholder': 'For example: explain this month’s expense anomalies and highlight the business units to review',
      'scope.readOnly': 'This filter is read-only', 'scope.noOptions': 'No options available', 'scope.all': 'All',
      'asset.menu': 'Dashboard actions: {name}', 'asset.adjust': 'Adjust data scope', 'asset.openPage': 'Open page',
      'asset.open': 'Open {name} in the sidebar',
      'asset.openFailed': 'Failed to open: {reason}',
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
      'hint.error': 'Guandata アセットの検索に失敗しました',
      'hint.error.description': '後で再試行してください。続く場合は BI 接続を確認してください',
      'hint.unknownEnvironment': '環境 {env} は guancli で認証されていません',
      'hint.restart': 'Guandata プラグインは DSH Desktop の再起動後に有効になります',
      'hint.restart.description': '新しい Host モジュールは再起動時に読み込まれます。再起動して再読み込みしてください',
      'scope.title': 'ページのデータ範囲', 'scope.close': '閉じる', 'scope.loading': 'ページフィルターを読み込んでいます…',
      'scope.save': 'データ範囲を保存', 'scope.saved': '保存しました。Agent はこのデータ範囲を使用します',
      'scope.chip': 'データ範囲を確認', 'scope.confirm': '範囲を確認して続行',
      'scope.restored': '以前の範囲は無効です。現在のページフィルターを確認してください',
      'scope.analysisLabel': '分析要件（任意）', 'scope.analysisPlaceholder': '例：今月の費用異常を分析し、注目すべき事業単位を示してください',
      'scope.readOnly': 'このフィルターは読み取り専用です', 'scope.noOptions': '選択肢がありません', 'scope.all': 'すべて',
      'asset.menu': 'ダッシュボード操作：{name}', 'asset.adjust': 'データ範囲を調整', 'asset.openPage': 'ページを開く',
      'asset.open': '{name} をサイドバーで開く',
      'asset.openFailed': '開けませんでした：{reason}',
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
      'hint.error': 'Falló la búsqueda de activos de Guandata',
      'hint.error.description': 'Reintente más tarde; si persiste, revise la conexión BI',
      'hint.unknownEnvironment': 'El entorno {env} no está autenticado en guancli',
      'hint.restart': 'El plugin de Guandata requiere reiniciar DSH Desktop',
      'hint.restart.description': 'El nuevo módulo Host solo se carga al reiniciar; reinicie, recargue y reintente',
      'scope.title': 'Ámbito de datos de la página', 'scope.close': 'Cerrar', 'scope.loading': 'Cargando filtros…',
      'scope.save': 'Guardar ámbito', 'scope.saved': 'Guardado; el agente usará este ámbito',
      'scope.chip': 'Confirmar ámbito de datos', 'scope.confirm': 'Confirmar ámbito y continuar',
      'scope.restored': 'El ámbito anterior caducó. Revise los filtros actuales y confirme de nuevo',
      'scope.analysisLabel': 'Requisito de análisis (opcional)', 'scope.analysisPlaceholder': 'Por ejemplo: analice las anomalías de gastos y señale las unidades que requieren atención',
      'scope.readOnly': 'Este filtro es de solo lectura', 'scope.noOptions': 'No hay opciones', 'scope.all': 'Todos',
      'asset.menu': 'Acciones del panel: {name}', 'asset.adjust': 'Ajustar ámbito de datos', 'asset.openPage': 'Abrir página',
      'asset.open': 'Abrir {name} en la barra lateral',
      'asset.openFailed': 'Error al abrir: {reason}',
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
      'hint.error': 'Échec de la recherche d’actifs Guandata',
      'hint.error.description': 'Réessayez plus tard ; vérifiez la connexion BI si cela persiste',
      'hint.unknownEnvironment': "L'environnement {env} n'est pas authentifié dans guancli",
      'hint.restart': 'Le plugin Guandata nécessite un redémarrage de DSH Desktop',
      'hint.restart.description': 'Le nouveau module Host ne se charge qu’au redémarrage ; redémarrez, rechargez puis réessayez',
      'scope.title': 'Portée des données de la page', 'scope.close': 'Fermer', 'scope.loading': 'Chargement des filtres…',
      'scope.save': 'Enregistrer la portée', 'scope.saved': 'Enregistré ; l’agent utilisera cette portée',
      'scope.chip': 'Confirmer la portée', 'scope.confirm': 'Confirmer et continuer',
      'scope.restored': 'La portée précédente a expiré. Vérifiez les filtres actuels et confirmez à nouveau',
      'scope.analysisLabel': 'Demande d’analyse (facultatif)', 'scope.analysisPlaceholder': 'Par exemple : analysez les anomalies de dépenses et identifiez les unités à examiner',
      'scope.readOnly': 'Ce filtre est en lecture seule', 'scope.noOptions': 'Aucune option disponible', 'scope.all': 'Tous',
      'asset.menu': 'Actions du tableau : {name}', 'asset.adjust': 'Ajuster la portée', 'asset.openPage': 'Ouvrir la page',
      'asset.open': 'Ouvrir {name} dans la barre latérale',
      'asset.openFailed': 'Échec de l’ouverture : {reason}',
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
      'hint.error': 'Guandata-Assetsuche fehlgeschlagen',
      'hint.error.description': 'Später erneut versuchen; sonst BI-Verbindung prüfen',
      'hint.unknownEnvironment': 'Umgebung {env} ist in guancli nicht authentifiziert',
      'hint.restart': 'Das Guandata-Plugin benötigt einen DSH-Desktop-Neustart',
      'hint.restart.description': 'Das neue Host-Modul lädt erst nach dem Neustart; neu starten, Seite neu laden, erneut versuchen',
      'scope.title': 'Datenbereich der Seite', 'scope.close': 'Schließen', 'scope.loading': 'Seitenfilter werden geladen…',
      'scope.save': 'Datenbereich speichern', 'scope.saved': 'Gespeichert; der Agent verwendet diesen Datenbereich',
      'scope.chip': 'Datenbereich bestätigen', 'scope.confirm': 'Bestätigen und fortfahren',
      'scope.restored': 'Der vorherige Bereich ist abgelaufen. Prüfen Sie die aktuellen Filter und bestätigen Sie erneut',
      'scope.analysisLabel': 'Analyseanforderung (optional)', 'scope.analysisPlaceholder': 'Zum Beispiel: Analysieren Sie die Kostenanomalien und nennen Sie die zu prüfenden Geschäftsbereiche',
      'scope.readOnly': 'Dieser Filter ist schreibgeschützt', 'scope.noOptions': 'Keine Optionen verfügbar', 'scope.all': 'Alle',
      'asset.menu': 'Dashboard-Aktionen: {name}', 'asset.adjust': 'Datenbereich anpassen', 'asset.openPage': 'Seite öffnen',
      'asset.open': '{name} in der Seitenleiste öffnen',
      'asset.openFailed': 'Öffnen fehlgeschlagen: {reason}',
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
      'hint.error': 'Не удалось выполнить поиск активов Guandata',
      'hint.error.description': 'Повторите позже; проверьте подключение к BI',
      'hint.unknownEnvironment': 'Среда {env} не авторизована в guancli',
      'hint.restart': 'Плагину Guandata нужен перезапуск DSH Desktop',
      'hint.restart.description': 'Новый модуль Host загружается только после перезапуска; перезапустите и повторите',
      'scope.title': 'Диапазон данных страницы', 'scope.close': 'Закрыть', 'scope.loading': 'Загрузка фильтров…',
      'scope.save': 'Сохранить диапазон', 'scope.saved': 'Сохранено; агент будет использовать этот диапазон',
      'scope.chip': 'Подтвердить диапазон', 'scope.confirm': 'Подтвердить и продолжить',
      'scope.restored': 'Прежний диапазон недействителен. Проверьте текущие фильтры и подтвердите снова',
      'scope.analysisLabel': 'Задача анализа (необязательно)', 'scope.analysisPlaceholder': 'Например: проанализируйте отклонения расходов и укажите подразделения, требующие внимания',
      'scope.readOnly': 'Этот фильтр доступен только для чтения', 'scope.noOptions': 'Нет доступных вариантов', 'scope.all': 'Все',
      'asset.menu': 'Действия с панелью: {name}', 'asset.adjust': 'Изменить диапазон данных', 'asset.openPage': 'Открыть страницу',
      'asset.open': 'Открыть «{name}» в боковой панели',
      'asset.openFailed': 'Не удалось открыть: {reason}',
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
      'hint.error': 'Falha na busca de ativos Guandata',
      'hint.error.description': 'Tente mais tarde; verifique a conexão BI',
      'hint.unknownEnvironment': 'O ambiente {env} não está autenticado no guancli',
      'hint.restart': 'O plugin Guandata requer reiniciar o DSH Desktop',
      'hint.restart.description': 'O novo módulo Host só carrega após reiniciar; reinicie, recarregue e tente de novo',
      'scope.title': 'Escopo de dados da página', 'scope.close': 'Fechar', 'scope.loading': 'Carregando filtros…',
      'scope.save': 'Salvar escopo', 'scope.saved': 'Salvo; o agente usará este escopo',
      'scope.chip': 'Confirmar escopo', 'scope.confirm': 'Confirmar e continuar',
      'scope.restored': 'O escopo anterior expirou. Revise os filtros atuais e confirme novamente',
      'scope.analysisLabel': 'Pedido de análise (opcional)', 'scope.analysisPlaceholder': 'Por exemplo: analise as anomalias de despesas e destaque as unidades de negócio prioritárias',
      'scope.readOnly': 'Este filtro é somente leitura', 'scope.noOptions': 'Nenhuma opção disponível', 'scope.all': 'Todos',
      'asset.menu': 'Ações do painel: {name}', 'asset.adjust': 'Ajustar escopo de dados', 'asset.openPage': 'Abrir página',
      'asset.open': 'Abrir {name} na barra lateral',
      'asset.openFailed': 'Falha ao abrir: {reason}',
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

    /** Funnel glyph for conversation scope-confirmation chips. */
    function FilterIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M4 5h16l-6.2 7v5.2L10.2 19v-7z' }))
    }

    /** Cached result of the one-time Host capability probe. */
    let hostReady

    /** Current session identity, refreshed by the composer dock entry and
     *  by @-mention candidate requests (both carry the active session). */
    const sessionCapture = { sessionId: '', environment: '' }

    /** Lowest Host generation that serves environment-scoped candidates. */
    const MIN_HOST_VERSION = '0.10.1'

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

    function createScopeEditor({ onConfirmed } = {}) {
      let state = {
        open: false, sessionId: '', scopeId: '', scope: null, reference: '', mode: 'edit', restored: false,
        selections: {}, options: {}, analysisRequest: '', error: '', saving: false, saved: false,
      }
      let generation = 0
      const listeners = new Set()
      const notify = () => { for (const listener of listeners) listener() }
      const set = (patch) => { state = { ...state, ...patch }; notify() }
      const scopeIdFromRef = (ref) => /^@\[[^\]\n]+\]\(dsh-guancli:page:[^:\s)]+:[^?\s)]+\?scope=([A-Za-z0-9_-]+)\)$/u.exec(String(ref ?? ''))?.[1]
      const identityFromRef = (ref) => {
        const match = /^@\[[^\]\n]+\]\(dsh-guancli:page:([^:\s)]+):([^?\s)]+)\?scope=[A-Za-z0-9_-]+\)$/u.exec(String(ref ?? ''))
        return match ? { profile: match[1], pageId: match[2].replace(/\?scope=.*$/u, '') } : null
      }
      const selectionsFor = (scope) => Object.fromEntries((scope?.selectors ?? [])
        .filter((selector) => selector.editable)
        .map((selector) => [selector.id, { values: [...selector.values], displayValues: [...selector.displayValues] }]))
      const refresh = async () => {
        const scope = state.scope
        if (!scope) return
        const currentGeneration = ++generation
        const selections = state.selections
        const options = {}
        try {
          for (const selector of scope.selectors) {
            if (selector.type !== 'DS_ELEMENTS' || !selector.editable) continue
            const result = await rpc('scope.options', {
              sessionId: state.sessionId, scopeId: state.scopeId, selectorId: selector.id, selections,
            })
            if (result.error !== undefined) throw new Error(result.error)
            options[selector.id] = result.data.options
          }
          if (currentGeneration !== generation) return
          const nextSelections = { ...selections }
          for (const selector of scope.selectors) {
            const available = options[selector.id]
            if (!available) continue
            const selected = selections[selector.id]
            const allowed = new Set(available.map((option) => option.value))
            const values = selected.values.filter((value) => allowed.has(value))
            if (values.length === selected.values.length) continue
            nextSelections[selector.id] = {
              values,
              displayValues: values.map((value) => available.find((option) => option.value === value)?.label ?? value),
            }
          }
          set({ options, selections: nextSelections, error: '' })
        } catch (error) {
          if (currentGeneration === generation) set({ error: error.message })
        }
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
        scopeIdFromRef,
        async open(sessionId, ref, { confirm = false, revise = false } = {}) {
          let scopeId = scopeIdFromRef(ref)
          const identity = identityFromRef(ref)
          if (!scopeId || !identity) return false
          let reference = ref
          set({
            open: true, sessionId, scopeId, scope: null, reference, restored: false,
            mode: confirm ? 'confirm' : 'edit', selections: {}, options: {}, analysisRequest: '', error: '', saved: false,
          })
          let result = await rpc('scope.get', { sessionId, scopeId })
          if (result.error !== undefined) {
            result = await rpc('scope.restore', { sessionId, scopeId, ...identity })
            if (result.error !== undefined) { set({ error: result.error }); return true }
          }
          if (revise && result.data.frozen) {
            result = await rpc('scope.revise', { sessionId, scopeId })
            if (result.error !== undefined) { set({ error: result.error }); return true }
            scopeId = result.data.scopeId
            reference = ref.replace(/\?scope=[A-Za-z0-9_-]+\)$/u, `?scope=${scopeId})`)
            set({ scopeId, reference })
          }
          set({ scope: result.data, selections: selectionsFor(result.data), restored: result.data.source === 'restored' })
          await refresh()
          return true
        },
        async select(selectorId, values, displayValues) {
          set({ selections: { ...state.selections, [selectorId]: { values, displayValues } }, saved: false })
          await refresh()
        },
        setAnalysisRequest(value) {
          set({ analysisRequest: String(value ?? '').slice(0, 4000) })
        },
        async save() {
          if (!state.scope || state.saving) return
          const confirming = state.mode === 'confirm'
          const { sessionId, reference, analysisRequest } = state
          set({ saving: true, error: '', saved: false })
          const result = await rpc(confirming ? 'scope.confirm' : 'scope.save', {
            sessionId, scopeId: state.scopeId, selections: state.selections,
          })
          if (result.error !== undefined) { set({ saving: false, error: result.error }); return }
          set({ scope: result.data, selections: selectionsFor(result.data), saving: false, saved: true })
          if (confirming && typeof onConfirmed === 'function') {
            try {
              await onConfirmed({ sessionId, reference, scope: result.data, analysisRequest })
              set({ open: false })
            } catch (error) {
              set({ error: `范围已确认，但继续分析投递失败：${error.message}` })
            }
          }
        },
        close() { generation += 1; set({ open: false }) },
      }
    }

    /**
     * Build the registered `@` source.
     * @param scope - context exposing `inputTriggers`, `slots`, and `locale`.
     * @returns one input-trigger source.
     */
    function createSource(scope, { onConfirmed } = {}) {
      const t = scope.locale.bind(NS)
      const scopeEditor = createScopeEditor({ onConfirmed })

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
          default:
            return hintRow(t('hint.error'), t('hint.error.description'))
        }
      }

      function ScopeEditor({ sessionId }) {
        const state = React.useSyncExternalStore(scopeEditor.subscribe, scopeEditor.getSnapshot)
        if (!state.open || state.sessionId !== sessionId) return null
        const page = state.scope
        const controlStyle = {
          minWidth: 72, maxWidth: 180, border: 0, outline: 'none',
          background: 'transparent', color: 'var(--dsw-alias-brand-primary)',
          font: 'inherit', fontSize: 12, cursor: 'pointer',
        }
        const fields = h('div', {
          className: 'guancli-scope-filter-bar',
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
        }, ...(page?.selectors ?? []).map((selector) => {
          const selection = state.selections[selector.id] ?? { values: [], displayValues: [] }
          const disabled = page.frozen || state.saving
          let control
          if (!selector.editable || page.frozen) {
            control = h('span', {
              title: text('scope.readOnly'), style: { color: 'var(--dsw-alias-label-secondary)' },
            }, selection.displayValues.join('、') || text('scope.all'))
          } else if (selector.type === 'DS_ELEMENTS') {
            const options = state.options[selector.id] ?? []
            if (options.length === 0) {
              control = h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, text('scope.noOptions'))
            } else if (selector.multiSelect) {
              control = h('details', { style: { position: 'relative' } },
                h('summary', {
                  style: { ...controlStyle, listStyle: 'none', userSelect: 'none' },
                }, selection.displayValues.join('、') || text('scope.all')),
                h('div', {
                  style: {
                    position: 'absolute', zIndex: 30, top: 'calc(100% + 6px)', left: 0,
                    minWidth: 180, maxWidth: 260, maxHeight: 220, overflow: 'auto',
                    padding: 6, border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8,
                    background: 'var(--dsw-alias-bg-overlay)', boxSizing: 'border-box',
                  },
                }, ...options.map((option) => h('label', {
                  key: option.value,
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12 },
                },
                  h('input', {
                    type: 'checkbox', value: option.value, checked: selection.values.includes(option.value), disabled,
                    onChange: (event) => {
                      const values = event.target.checked
                        ? [...selection.values, option.value]
                        : selection.values.filter((value) => value !== option.value)
                      const labels = values.map((value) => options.find((item) => item.value === value)?.label ?? value)
                      void scopeEditor.select(selector.id, values, labels)
                    },
                  }),
                  h('span', null, option.label),
                ))),
              )
            } else {
              control = h('select', {
                'aria-label': selector.name, disabled,
                value: selection.values[0] ?? '',
                onChange: (event) => {
                  const values = [...event.target.selectedOptions].map((option) => option.value).filter(Boolean)
                  const labels = values.map((value) => options.find((option) => option.value === value)?.label ?? value)
                  void scopeEditor.select(selector.id, values, labels)
                },
                style: controlStyle,
              },
                h('option', { value: '' }, text('scope.all')),
                ...options.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
              )
            }
          } else if (selector.type === 'TIME_MACRO') {
            const options = selector.options ?? []
            const selected = options.find((option) => JSON.stringify(option.values) === JSON.stringify(selection.values))
            control = h('select', {
              'aria-label': selector.name, disabled, value: selected?.value ?? '',
              onChange: (event) => {
                const option = options.find((item) => item.value === event.target.value)
                void scopeEditor.select(selector.id, option?.values ?? [], option ? [option.label] : [])
              },
              style: controlStyle,
            },
              h('option', { value: '' }, text('scope.all')),
              ...options.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
            )
          } else if (selector.type === 'CALENDAR') {
            const count = selector.operator === 'BT' ? 2 : 1
            control = h('div', { style: { display: 'flex', gap: 4 } },
              ...Array.from({ length: count }, (_, index) => h('input', {
                key: index, type: 'date', disabled, value: selection.values[index] ?? '',
                'aria-label': selector.name,
                onChange: (event) => {
                  const values = [...selection.values]
                  values[index] = event.target.value
                  void scopeEditor.select(selector.id, values.filter(Boolean), values.filter(Boolean))
                },
                style: { ...controlStyle, minWidth: 120 },
              })),
            )
          }
          return h('div', {
            key: selector.id, className: 'guancli-scope-filter', 'data-filter-id': selector.id,
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 7, boxSizing: 'border-box',
              minHeight: 34, maxWidth: '100%', padding: '4px 9px', borderRadius: 999,
              border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)',
              color: 'var(--dsw-alias-label-primary)', fontSize: 12,
            },
          },
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' } }, selector.name),
            control,
          )
        }))
        return h(Modal, {
          open: true, onClose: scopeEditor.close,
          title: `${text('scope.title')} · ${page?.pageName ?? ''}`,
          closeLabel: text('scope.close'), description: page?.summary,
          footer: h(React.Fragment, null,
            h(Button, { variant: 'outline', onClick: scopeEditor.close }, text('scope.close')),
            h(Button, {
              variant: 'primary', disabled: !page || page.frozen || state.saving,
              onClick: () => void scopeEditor.save(),
            }, state.saving
              ? `${text(state.mode === 'confirm' ? 'scope.confirm' : 'scope.save')}…`
              : text(state.mode === 'confirm' ? 'scope.confirm' : 'scope.save')),
          ),
        },
          state.error ? h('p', { role: 'alert' }, state.error) : null,
          state.restored ? h('p', {
            role: 'status', style: { color: 'var(--dsw-alias-state-warn-primary)' },
          }, text('scope.restored')) : null,
          state.saved ? h('p', { role: 'status' }, text('scope.saved')) : null,
          !page ? (!state.error ? h('p', null, text('scope.loading')) : null) : fields,
          state.mode === 'confirm' && page ? h('label', {
            style: { display: 'block', marginTop: 16 },
          },
            h('span', {
              style: { display: 'block', marginBottom: 6, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
            }, text('scope.analysisLabel')),
            h('textarea', {
              rows: 3, value: state.analysisRequest, disabled: page.frozen || state.saving,
              placeholder: text('scope.analysisPlaceholder'),
              onChange: (event) => scopeEditor.setAnalysisRequest(event.target.value),
              style: {
                display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical',
                minHeight: 76, maxHeight: 220, padding: 10, borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l2)', outline: 'none',
                background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
                font: 'inherit', fontSize: 13, lineHeight: 1.5,
              },
            }),
          ) : null,
        )
      }

      /** Extract scoped page mentions from the user-message footer owner props. */
      function pageReferences(props) {
        const containers = [props?.message, props?.node?.message, props?.node, props?.item, props?.record, props]
        const texts = []
        for (const container of containers) {
          if (typeof container?.text === 'string') texts.push(container.text)
          if (typeof container?.raw === 'string') texts.push(container.raw)
          if (typeof container?.content === 'string') texts.push(container.content)
          if (!Array.isArray(container?.content)) continue
          for (const block of container.content) {
            if (block?.type === 'text' && typeof block.text === 'string') texts.push(block.text)
          }
        }
        const pattern = /@\[[^\]\n]+\]\(dsh-guancli:page:[^:\s)]+:[^?\s)]+\?scope=[A-Za-z0-9_-]+\)/gu
        const refs = []
        const seen = new Set()
        for (const value of texts) {
          for (const match of value.matchAll(pattern)) {
            if (seen.has(match[0])) continue
            seen.add(match[0])
            refs.push(match[0])
          }
        }
        return refs
      }

      /** Filter-style actions rendered directly below a sent asset mention. */
      function ScopeConfirmation(props) {
        const state = React.useSyncExternalStore(scopeEditor.subscribe, scopeEditor.getSnapshot)
        const refs = pageReferences(props)
        if (refs.length === 0) return null
        return h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
        }, ...refs.map((ref) => {
          const scopeId = scopeEditor.scopeIdFromRef(ref)
          const current = state.scope?.scopeId === scopeId ? state.scope : null
          const label = sanitizeLabel(/^@\[([^\]\n]+)\]/u.exec(ref)?.[1]) || scopeId
          return h('button', {
            key: scopeId,
            type: 'button',
            className: 'guancli-scope-filter-chip',
            title: text('scope.title'),
            onClick: () => scopeEditor.open(props.sessionId, ref, { confirm: current?.frozen !== true }),
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 6,
              maxWidth: '100%', padding: '4px 10px', borderRadius: 999,
              border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
              font: 'inherit', fontSize: 12, cursor: 'pointer',
            },
          },
            h(FilterIcon),
            h('span', null, `${label} · ${current?.frozen ? text('scope.title') : text('scope.chip')}${current ? `：${current.summary}` : ''}`),
          )
        }))
      }

      return {
        trigger: '@',
        name: SOURCE,
        order: -10,
        showGroupTitle: false,
        scopeEditor,
        ScopeEditor,
        ScopeConfirmation,
        openReference(session, reference) {
          const scopeId = scopeEditor.scopeIdFromRef(reference.ref)
          if (!scopeId) return false
          void scopeEditor.open(session.sessionId, reference.ref)
          return true
        },
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
          sessionCapture.sessionId = sessionId
          if (!(await ensureHost())) return [hintRow(t('hint.restart'), t('hint.restart.description'))]
          const keyword = String(request.query || '')
          const result = await rpc('candidates', { sessionId, query: keyword }, request.signal)
          if (result.aborted) return []
          if (result.error !== undefined || result.data === undefined) {
            return [hintRow(t('hint.error'), t('hint.error.description'))]
          }
          const data = result.data
          if (typeof data.env === 'string' && data.env !== '') sessionCapture.environment = data.env
          const items = Array.isArray(data.items) ? data.items : []
          if (items.length === 0) return [explain(data, keyword)]
          return items.map((item) => {
            const label = sanitizeLabel(item.name) || String(item.id)
            const section = item.type === 'page' ? t('section.pages') : t('section.datasets')
            const scopeDescription = item.scopeSummary ? ` · ${item.scopeSummary}` : ''
            return {
              name: label,
              description: `${item.env}${item.path ? ` · ${item.path}` : ''}${scopeDescription}`,
              icon: item.type === 'page' ? PageIcon : DatasetIcon,
              section,
              value: JSON.stringify({
                type: item.type, id: String(item.id), name: label, env: item.env,
                ...(item.scopeId ? { scopeId: item.scopeId, scopeSummary: item.scopeSummary } : {}),
              }),
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
          const suffix = value.type === 'page' && value.scopeId ? `?scope=${value.scopeId}` : ''
          const mention = `@[${label}](dsh-guancli:${value.type}:${value.env}:${value.id}${suffix})`
          const chipLabel = value.scopeSummary ? sanitizeLabel(`${label} · ${value.scopeSummary}`) : label
          return {
            insert: {
              source: SOURCE,
              ref: mention,
              label: chipLabel,
              clipboardText: mention,
            },
          }
        },
      }
    }

    /**
     * user-text rule: turn a sent asset mention into a clickable node.
     * The wire form carries env and id; the durable message keeps it verbatim.
     */
    const assetMentionRule = {
      id: 'guancli-asset',
      order: 10,
      match(text, from) {
        const wire = /@\[([^\]\n]{1,200})\]\(dsh-guancli:(page|dataset):([^:\s)]+):([^?\s)]+)(?:\?scope=([A-Za-z0-9_-]+))?\)/gu
        let start = text.indexOf('@', from)
        while (start >= 0) {
          wire.lastIndex = start
          const found = wire.exec(text)
          if (found !== null && found.index === start) {
            return {
              id: 'guancli-asset',
              start,
              end: start + found[0].length,
              data: {
                label: sanitizeLabel(found[1]) || found[4],
                type: found[2],
                env: found[3],
                id: found[4],
                ...(found[2] === 'page' && found[5] ? { scopeId: found[5] } : {}),
              },
            }
          }
          start = text.indexOf('@', start + 1)
        }
        return undefined
      },
    }

    function assetReference(data) {
      const label = sanitizeLabel(data.label) || String(data.id)
      const suffix = data.type === 'page' && data.scopeId ? `?scope=${data.scopeId}` : ''
      return `@[${label}](dsh-guancli:${data.type}:${data.env}:${data.id}${suffix})`
    }

    /**
     * Clickable asset chip rendered inside sent user messages.
     * Scoped pages open an action menu; other assets open directly.
     */
    function AssetLink({ node, openAsset, openMenu, sessionId, t }) {
      const data = node.data || {}
      const label = data.label || data.id || '观远资产'
      const translate = typeof t === 'function' ? t : (key) => key
      return h('button', {
        type: 'button',
        className: 'guancli-asset-link',
        title: data.type === 'page' && data.scopeId
          ? translate('asset.menu', { name: label })
          : translate('asset.open', { name: label }),
        'aria-haspopup': data.type === 'page' && data.scopeId ? 'menu' : undefined,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          padding: '0 2px',
          background: 'transparent',
          color: 'var(--dsw-alias-state-business-primary, #0F6FE0)',
          font: 'inherit',
          cursor: 'pointer',
          borderBottom: '1px dashed currentColor',
        },
        onClick: (event) => {
          if (data.type === 'page' && data.scopeId && typeof openMenu === 'function') {
            return openMenu(data, sessionId, event)
          }
          return typeof openAsset === 'function' ? openAsset(data) : undefined
        },
      },
        h('span', { 'aria-hidden': true }, data.type === 'page' ? '📊' : '🗂️'),
        h('span', null, label),
        data.type === 'page' && data.scopeId ? h('span', { 'aria-hidden': true }, '▾') : null,
      )
    }

    /** Console prefixes the probe logs with (mirror src/probe.js). */
    const PROBE_LOG_PREFIX = '__GUANCLI_DASHBOARD_CONTEXT__'
    const DOM_PROBE_PREFIX = '__GUANCLI_DOM_PROBE__'
    const HEARTBEAT_PREFIX = '__GUANCLI_HEARTBEAT__'
    const NET_PROBE_PREFIX = '__GUANCLI_NET_PROBE__'
    /** Console prefix the in-page ask widget logs with (mirror src/ask-widget.js). */
    const ASK_PREFIX = '__GUANCLI_PAGE_ASK__'

    /**
     * Parse one console line from the ask widget (browser copy of
     * src/ask-widget.js parseAskOutput, kept dependency-free).
     * @param text - console message text.
     * @returns the question object or null.
     */
    function parseAskOutputText(text) {
      const raw = String(text ?? '')
      if (!raw.startsWith(ASK_PREFIX)) return null
      try {
        const value = JSON.parse(raw.slice(ASK_PREFIX.length))
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
        const question = String(value.text ?? '').trim()
        if (question === '' || question.length > 4000) return null
        return { text: question, url: String(value.url ?? '').slice(0, 500), at: Number(value.at ?? 0) }
      } catch (_error) {
        return null
      }
    }

    /**
     * Parse one console line from the injected probe (browser copy of the
     * node-side parser, kept dependency-free for the module bundle).
     * @param text - console message text.
     * @returns the context object or null.
     */
    function parseProbeOutputText(text) {
      const raw = String(text ?? '')
      if (!raw.startsWith(PROBE_LOG_PREFIX)) return null
      try {
        const value = JSON.parse(raw.slice(PROBE_LOG_PREFIX.length))
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
        if (!/^[a-z0-9]{24}$/i.test(String(value.pageId ?? ''))) return null
        return {
          pageId: String(value.pageId),
          pageName: String(value.pageName ?? ''),
          url: String(value.url ?? ''),
          selectors: Array.isArray(value.selectors) ? value.selectors : [],
          ...(value.selectorPrecise === undefined ? {} : { selectorPrecise: value.selectorPrecise === true }),
          focusedCardId: String(value.focusedCardId ?? ''),
          capturedAt: Number(value.capturedAt ?? 0),
        }
      } catch (_error) {
        return null
      }
    }

    /**
     * Match a URL's host against authenticated environment URLs.
     * @param rawUrl - webview URL.
     * @param environments - environment entries with urls.
     * @param preferred - session-selected or CLI default environment.
     * @returns the environment name or null.
     */
    function matchEnvironmentName(rawUrl, environments, preferred) {
      let host = ''
      try {
        host = new URL(String(rawUrl ?? '')).hostname.toLowerCase()
      } catch (_error) {
        return null
      }
      if (host === '') return null
      const matches = (environment) => {
        try {
          const envHost = new URL(String(environment.url ?? '')).hostname.toLowerCase()
          return envHost !== '' && (host === envHost || host.endsWith(`.${envHost}`))
        } catch (_error) {
          return false
        }
      }
      const preferredEnvironment = (environments ?? []).find((environment) => environment.name === preferred)
      if (preferredEnvironment !== undefined && matches(preferredEnvironment)) return String(preferredEnvironment.name)
      return (environments ?? []).find((environment) => matches(environment))?.name ?? null
    }

    /** Inlined dashboard probe (generated from src/probe.js — do not edit by hand; run scripts/sync-probe.mjs). */
    const PROBE_SCRIPT = "(() => {\n  const PROBE_VERSION = '0.11.0'\n  const existing = globalThis.__guancliDashboardProbe\n  if (existing && existing.version === PROBE_VERSION) return 'already-installed'\n  if (existing && typeof existing.stop === 'function') existing.stop()\n\n  const ID_PATTERN = /^[a-z0-9]{24}$/i\n  const ROOT_SELECTOR = '[data-selector-id],[data-cd-id],[data-card-id],[data-component-id]'\n  const MAX_SELECTORS = 30\n  const MAX_VALUES = 50\n  const DOM_PROBE_PREFIX = '__GUANCLI_DOM_PROBE__'\n  const HEARTBEAT_PREFIX = '__GUANCLI_HEARTBEAT__'\n  const NET_PROBE_PREFIX = '__GUANCLI_NET_PROBE__'\n  let focusedCardId = ''\n  let runtimeContext = null\n  let timer = null\n  let lastPublished = ''\n\n  function idFrom(element) {\n    if (!element) return ''\n    for (const name of ['data-selector-id', 'data-cd-id', 'data-card-id', 'data-component-id']) {\n      const value = element.getAttribute?.(name) || ''\n      if (ID_PATTERN.test(value)) return value\n    }\n    return ID_PATTERN.test(element.id || '') ? element.id : ''\n  }\n\n  function pageId() {\n    try {\n      const url = new URL(location.href)\n      for (const key of ['pageId', 'page_id', 'pgId', 'pg_id']) {\n        const value = url.searchParams.get(key) || new URLSearchParams(url.hash.split('?')[1] || '').get(key)\n        if (ID_PATTERN.test(value || '')) return value\n      }\n      const routeMatch = location.href.match(/(?:page|dashboard|analysis)[/=:]([a-z0-9]{24})(?:[/?#&]|$)/i)\n      if (routeMatch) return routeMatch[1]\n      for (const selector of ['[data-page-id]', '[data-pg-id]']) {\n        const node = document.querySelector(selector)\n        const value = node?.getAttribute(selector.includes('page') ? 'data-page-id' : 'data-pg-id') || ''\n        if (ID_PATTERN.test(value)) return value\n      }\n    } catch (_error) {}\n    return ''\n  }\n\n  function cleanText(value) {\n    return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 500)\n  }\n\n  function selectedValues(root) {\n    const values = []\n    const add = (value) => {\n      const normalized = cleanText(value)\n      if (!normalized || /^(全部|全选|请选择|搜索)$/i.test(normalized) || values.includes(normalized)) return\n      values.push(normalized)\n    }\n    for (const option of root.querySelectorAll('select option:checked')) add(option.value || option.textContent)\n    for (const input of root.querySelectorAll('input[type=\"checkbox\"]:checked,input[type=\"radio\"]:checked')) add(input.value || input.getAttribute('aria-label'))\n    for (const input of root.querySelectorAll('input:not([type=\"checkbox\"]):not([type=\"radio\"])')) if (input.value) add(input.value)\n    for (const node of root.querySelectorAll('[aria-selected=\"true\"],.ant-select-selection-item')) add(node.getAttribute('title') || node.textContent)\n    return values.slice(0, MAX_VALUES)\n  }\n\n  function domSelectors() {\n    const selections = []\n    const seen = new Set()\n    for (const root of document.querySelectorAll(ROOT_SELECTOR)) {\n      const selectorId = idFrom(root)\n      if (!selectorId || seen.has(selectorId)) continue\n      const values = selectedValues(root)\n      if (!values.length) continue\n      seen.add(selectorId)\n      selections.push({ selectorId, values, displayValues: values, operator: values.length > 1 ? 'IN' : 'EQ', origin: 'dom' })\n      if (selections.length >= MAX_SELECTORS) break\n    }\n    return selections\n  }\n\n  /**\n   * Short single-line text usable as a widget label; rejects empty and\n   * over-long strings (titles in this BI build stay well under 40 chars).\n   */\n  function labelText(value) {\n    const text = cleanText(value)\n    return text === '' || text.length > 40 ? '' : text\n  }\n\n  /**\n   * Resolve a canvas selector's display name by walking up from the widget.\n   * Canvas DS_ELEMENTS filters carry no aria-label and no data-* identity,\n   * but their card header holds the selector title (货号/四级类目/评论日期)\n   * in a title/name element, or as the first short text sibling that does\n   * not itself contain a form widget (so a neighbouring selector's value\n   * can never be mistaken for the title).\n   */\n  function cardTitle(box) {\n    let node = box.parentElement\n    for (let depth = 0; node !== null && depth < 6; depth += 1, node = node.parentElement) {\n      for (const el of node.querySelectorAll('[class*=\"title\"],[class*=\"Title\"],[class*=\"name\"],[class*=\"Name\"]')) {\n        if (box.contains(el)) continue\n        const text = labelText(el.getAttribute('title') || el.textContent)\n        if (text !== '') return text\n      }\n      for (const child of node.children) {\n        if (child === box || child.contains(box)) continue\n        if (child.querySelector('input,select,[role=\"combobox\"],.ant-select') !== null) continue\n        const text = labelText(child.textContent)\n        if (text !== '' && !/^自动铺满/u.test(text)) return text\n      }\n    }\n    return ''\n  }\n\n  /**\n   * Wide-pass capture for BI builds whose filter widgets carry no\n   * data-* identity: aggregate selected pills per combobox, plus valued\n   * inputs and checked options. Fingerprinted by container class+label,\n   * origin-tagged 'dom-wide'; noise is accepted over silence — the merge\n   * step whitelists by field name anyway.\n   */\n  function wideSelectors() {\n    const out = []\n    const seen = new Set()\n    // Keep colliding fingerprints as separate widgets instead of dropping\n    // them: identical global-bar and canvas date inputs (same empty\n    // name/id/class, same placeholder) must both survive.\n    const unique = (fingerprint) => {\n      if (!seen.has(fingerprint)) return fingerprint\n      let index = 2\n      while (seen.has(fingerprint + '#' + String(index))) index += 1\n      return fingerprint + '#' + String(index)\n    }\n    const push = (fingerprint, values, extra) => {\n      const cleaned = values.map(cleanText).filter((value) => value !== '')\n      // Empty values are reported only for identified filter controls that\n      // explicitly mark themselves unapplied (applied:false); everything\n      // else empty is noise.\n      if (cleaned.length === 0 && extra?.applied !== false) return\n      if (seen.has(fingerprint)) return\n      const named = extra?.name !== undefined && extra.name !== ''\n      // Unnamed widgets are accepted only when they are unambiguous filter\n      // controls: segmented widgets, or selects carrying this BI build's\n      // selector (SEL_) classes — canvas DS_ELEMENTS cards included. Other\n      // unlabeled widgets are canvas layout controls (e.g. '自动铺满(70%)').\n      if (!named && extra?.widget !== 'segmented' && extra?.selectorClassed !== true) return\n      // Cross-pass dedupe: the same widget surfacing in two passes (e.g. a\n      // SearchList ant-select and its SEL_ wrapper) must not appear twice.\n      if (named && out.some((entry) => entry.name === extra.name\n        && JSON.stringify(entry.values) === JSON.stringify(cleaned.slice(0, MAX_VALUES)))) return\n      seen.add(fingerprint)\n      out.push({\n        selectorId: 'wide-' + String(out.length + 1),\n        values: cleaned.slice(0, MAX_VALUES),\n        displayValues: cleaned.slice(0, MAX_VALUES),\n        operator: cleaned.length > 1 ? 'IN' : 'EQ',\n        origin: 'dom-wide',\n        ...extra,\n      })\n    }\n    const WIDE_BOX_QUERY = '[role=\"combobox\"],.ant-select,[class*=\"Select\"],[class*=\"selector\"]'\n    for (const box of document.querySelectorAll(WIDE_BOX_QUERY)) {\n      // Canvas layout chrome (the '自动铺满(70%)' zoom control), not a filter.\n      if (String(box.className || '').includes('scale-selector') || box.closest('.scale-selector') !== null) continue\n      // Inner chrome of an already-matched widget (e.g. .ant-select-selector\n      // inside .ant-select, both matching [class*=\"selector\"]) must not\n      // double-count the same filter control; the outermost match wins.\n      if (box.parentElement !== null && box.parentElement.closest(WIDE_BOX_QUERY) !== null) continue\n      const selectorClassed = box.matches('.SEL_select, [class*=\"SEL_\"]')\n      const items = [...box.querySelectorAll('.ant-select-selection-item,[aria-selected=\"true\"]')]\n      const pills = items\n        .map((el) => cleanText(el.getAttribute('title') || el.textContent))\n        .filter((value) => value !== '' && !/^(全部|全选|请选择|搜索)$/iu.test(value))\n      if (pills.length === 0 && !(items.length > 0 && selectorClassed)) continue\n      // Page filters in this BI build carry SEL_ class tokens; prefer a\n      // label from the nearest filter container, then fall back to the\n      // enclosing card's title (canvas DS_ELEMENTS).\n      const holder = box.closest('[class*=\"SEL_\"],[class*=\"filter\"],[class*=\"Filter\"],[class*=\"selector\"],[data-selector-id]')\n      const label = cleanText(\n        holder?.querySelector('[class*=\"title\"],[class*=\"label\"],label')?.textContent\n        || box.getAttribute('aria-label') || '',\n      ).slice(0, 40) || cardTitle(box)\n      push(unique('box:' + String(box.className || '').slice(0, 60) + ':' + label), pills, {\n        name: label || undefined,\n        selectorClassed,\n        ...(pills.length === 0 ? { applied: false } : {}),\n      })\n    }\n    // SearchBox-type page selectors (季度/月份 on this BI build): the\n    // selected value is plain text in .fp-selector-font element(s) inside a\n    // SEL_ container — no ant-select pills, no input value, so the passes\n    // above structurally cannot see them. Containers wrapping a SearchList\n    // (.ant-select inside) were already handled by the box loop.\n    for (const container of document.querySelectorAll('[class*=\"SEL_\"]')) {\n      if (container.querySelector('.ant-select') !== null) continue\n      const valueEls = [...container.querySelectorAll('.fp-selector-font')]\n      if (valueEls.length === 0) continue\n      const isValueEl = (el) => valueEls.some((valueEl) => valueEl === el || valueEl.contains(el) || el.contains(valueEl))\n      const rawText = valueEls.map((el) => cleanText(el.getAttribute('title') || el.textContent)).filter((text) => text !== '').join(',')\n      const values = rawText === '' ? [] : rawText.split(/[,，、]/u)\n        .map(cleanText)\n        .filter((value) => value !== '' && !/^(全部|全选|请选择|搜索)$/iu.test(value))\n      // The label sits in a title/label element that is not the value\n      // itself (the value element also carries a *-title color class).\n      let label = ''\n      for (const el of container.querySelectorAll('[class*=\"title\"],[class*=\"label\"],label')) {\n        if (isValueEl(el)) continue\n        const text = labelText(el.getAttribute('title') || el.textContent)\n        if (text !== '' && text !== rawText) { label = text; break }\n      }\n      if (label === '') label = cardTitle(container)\n      push(unique('sb:' + String(container.className || '').slice(0, 60) + ':' + label), values, {\n        name: label || undefined,\n        widget: 'searchbox',\n        selectorClassed: true,\n        ...(values.length === 0 ? { applied: false } : {}),\n      })\n    }\n    // Segmented single-select widgets (e.g. LR=可用库存): the selected item\n    // is unambiguous even without a label, so accept unnamed ones — BI uses\n    // segmented almost exclusively for filters/switches, not layout.\n    for (const seg of document.querySelectorAll('.ant-segmented')) {\n      if (String(seg.className || '').includes('scale-selector') || seg.closest('.scale-selector') !== null) continue\n      const selected = seg.querySelector('.ant-segmented-item-selected')\n      const value = cleanText(selected?.textContent || '')\n      if (value === '' || /^(全部|全选|请选择|搜索)$/iu.test(value)) continue\n      const holder = seg.closest('[class*=\"SEL_\"],[class*=\"filter\"],[class*=\"Filter\"]')\n      const label = cleanText(\n        holder?.querySelector('[class*=\"title\"],[class*=\"label\"],label')?.textContent\n        || seg.getAttribute('aria-label') || '',\n      ).slice(0, 40) || cardTitle(seg)\n      push(unique('seg:' + String(seg.className || '').slice(0, 60) + ':' + label), [value], { name: label || undefined, widget: 'segmented' })\n    }\n    for (const input of document.querySelectorAll('input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"hidden\"])')) {\n      const value = cleanText(input.value)\n      if (value === '') continue\n      const placeholder = cleanText(input.getAttribute('placeholder') || input.getAttribute('aria-label') || input.name || '').slice(0, 40)\n      // Canvas date-range cards (评论日期) reuse the same 开始/结束日期\n      // placeholders as the global bar (发货月); prefix the card title so\n      // the two pairs stay distinguishable after fingerprint dedupe.\n      const title = cardTitle(input)\n      const label = title !== '' && placeholder !== '' && !placeholder.includes(title)\n        ? title + '·' + placeholder\n        : placeholder || title\n      push(unique('input:' + String(input.name || input.id || input.className || '').slice(0, 60) + ':' + label), [value], { name: label || undefined })\n    }\n    for (const select of document.querySelectorAll('select')) {\n      const values = [...select.selectedOptions].map((option) => cleanText(option.value || option.textContent)).filter((value) => value !== '')\n      if (values.length === 0) continue\n      const label = cleanText(select.name || '').slice(0, 40) || cardTitle(select) || undefined\n      push(unique('select:' + String(select.name || select.id || select.className || '').slice(0, 60)), values, { name: label })\n    }\n    return out.slice(0, MAX_SELECTORS)\n  }\n\n  /**\n   * Pick the selector list: network-captured filters win (they carry the\n   * exact selector→field→dataset binding from the BI query payload), then\n   * the runtime broadcast when it actually carries entries, then the\n   * identified-widget DOM pass, then the wide pass. Entries are\n   * origin-tagged. 'precise' is false only when the wide pass carried the\n   * result — that is exactly when a DOM recon report is most needed.\n   */\n  function resolveSelectors() {\n    const net = [...netSelectors.values()].filter((entry) => entry.applied !== false)\n    if (net.length > 0) return { list: net.slice(0, MAX_SELECTORS), precise: true }\n    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}\n    if (Array.isArray(runtime.selectors) && runtime.selectors.length > 0) {\n      return { list: runtime.selectors.slice(0, MAX_SELECTORS).map((selector) => ({ origin: 'runtime', ...selector })), precise: true }\n    }\n    const dom = domSelectors()\n    if (dom.length > 0) return { list: dom, precise: true }\n    return { list: wideSelectors(), precise: false }\n  }\n\n  function safeUrl() {\n    try {\n      const url = new URL(location.href)\n      const hashPath = url.hash ? url.hash.split('?')[0] : ''\n      return url.origin + url.pathname + hashPath\n    } catch (_error) {\n      return location.href\n    }\n  }\n\n  function snapshot() {\n    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}\n    const currentPageId = String(runtime.pageId || pageId())\n    const resolved = resolveSelectors()\n    return {\n      pageId: currentPageId,\n      pageName: cleanText(runtime.pageName || document.querySelector('[data-page-name],h1')?.textContent || document.title),\n      url: safeUrl(),\n      selectors: resolved.list,\n      selectorPrecise: resolved.precise,\n      focusedCardId: String(runtime.focusedCardId || focusedCardId || ''),\n      capturedAt: Date.now(),\n    }\n  }\n\n  /** Last DOM recon emission, throttled to one per 30 seconds. */\n  let lastDomProbeAt = 0\n  /** Last heartbeat emission, throttled to one per 20 seconds. */\n  let lastHeartbeatAt = 0\n\n  /**\n   * Recon pass over unknown BI DOM: input/select inventory, data-* attribute\n   * names, and candidate listbox/filter containers. Sent only while the\n   * selector list stays empty so the plugin author can adapt the real DOM.\n   */\n  function domProbe() {\n    const inputs = []\n    for (const el of document.querySelectorAll('input, select, textarea')) {\n      inputs.push({\n        tag: el.tagName.toLowerCase(),\n        type: el.type || '',\n        name: el.getAttribute('name') || '',\n        placeholder: (el.getAttribute('placeholder') || '').slice(0, 60),\n        value: String(el.value ?? '').slice(0, 60),\n        cls: String(el.className || '').slice(0, 80),\n        label: String(el.getAttribute('aria-label') || (el.closest('label')?.textContent || '')).slice(0, 60),\n        data: Object.keys(el.dataset || {}).slice(0, 8),\n      })\n      if (inputs.length >= 40) break\n    }\n    const dataNames = new Set()\n    for (const el of document.querySelectorAll('[data-selector-id],[data-cd-id],[data-card-id],[data-component-id],[data-page-id]')) {\n      for (const attr of el.attributes) if (attr.name.startsWith('data-')) dataNames.add(attr.name)\n    }\n    const containers = []\n    for (const el of document.querySelectorAll('[role=\"listbox\"],[role=\"combobox\"],[class*=\"select\"],[class*=\"selector\"],[class*=\"filter\"]')) {\n      containers.push({\n        cls: String(el.className || '').slice(0, 80),\n        text: cleanText(el.textContent).slice(0, 80),\n        role: el.getAttribute('role') || '',\n      })\n      if (containers.length >= 25) break\n    }\n    return {\n      kind: 'dom-probe',\n      url: safeUrl(),\n      title: cleanText(document.title),\n      dataNames: [...dataNames],\n      inputs,\n      containers,\n    }\n  }\n\n  function heartbeat() {\n    if (Date.now() - lastHeartbeatAt < 20_000) return\n    lastHeartbeatAt = Date.now()\n    console.log('__GUANCLI_HEARTBEAT__' + JSON.stringify({\n      kind: 'heartbeat',\n      href: (() => { try { return location.href } catch (_e) { return '' } })(),\n      pageId: pageId(),\n      readyState: document.readyState,\n      at: Date.now(),\n    }))\n  }\n\n  // #region network recon: capture the BI page's own API calls.\n  // Filter changes on a BI dashboard are re-queried through fetch/XHR; the\n  // request payload carries the exact selector→field→dataset mapping that\n  // neither the (nonexistent) runtime broadcast nor the DOM can provide.\n  // Phase 1 is reconnaissance: report endpoint inventory plus JSON request\n  // bodies so the selector extractor can be written against real payloads.\n\n  /** Per-page capture budgets; recon must never flood the console. */\n  const NET_MAX_COMPACT = 200\n  const NET_MAX_DETAILED = 30\n  /** Card data queries carry the interaction state — always detailed. */\n  const NET_MAX_CARD_DETAILED = 60\n  /** Static assets and telemetry never carry dashboard state. */\n  const NET_SKIP_PATH = /\\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|map|ico)(?:[?#]|$)|\\/(?:static|vendor|polyfill)\\/|log|track|sentry|monitor|heartbeat/i\n  /** Paths whose JSON bodies are always captured in detail. */\n  const NET_DETAIL_PATH = /query|condition|selector|filter|page|card|data|ds|batch|search|report|chart/i\n  const netState = { seen: new Set(), compact: 0, detailed: 0, cardDetailed: 0 }\n\n  /**\n   * Live selector state learned from card query payloads, keyed by the\n   * source selector control id. Each /api/card/<cdId>/data request repeats\n   * the page's applied filters with exact bindings:\n   *   { name, fdId, dsId, cdId, filterType, sourceCdId, filterValue[] }\n   * so one entry per selector aggregates every bound (dsId, field) pair.\n   */\n  const netSelectors = new Map()\n\n  /** Card data queries repeat the applied page filters in their body. */\n  const NET_CARD_DATA_PATH = /\\/api\\/card\\/[a-z0-9]{24}\\/data$/i\n\n  /**\n   * Fold one card-query body into netSelectors. A filter entry with an\n   * empty filterValue means the selector was cleared for that card.\n   * @returns whether any selector entry changed.\n   */\n  function ingestCardQuery(bodyText) {\n    let parsed\n    try {\n      parsed = JSON.parse(bodyText)\n    } catch (_error) {\n      return false\n    }\n    const filters = parsed && Array.isArray(parsed.filters) ? parsed.filters : null\n    if (filters === null) return false\n    let changed = false\n    for (const filter of filters) {\n      if (filter === null || typeof filter !== 'object') continue\n      const selectorId = String(filter.sourceCdId || '')\n      if (selectorId === '') continue\n      const values = (Array.isArray(filter.filterValue) ? filter.filterValue : [])\n        .map((value) => (value === null || typeof value === 'object' ? JSON.stringify(value) : String(value)))\n        .filter((value) => value !== '')\n        .slice(0, MAX_VALUES)\n      let entry = netSelectors.get(selectorId)\n      if (entry === undefined) {\n        entry = { selectorId, name: '', operator: '', values: [], displayValues: [], targets: [], origin: 'net', applied: false }\n        netSelectors.set(selectorId, entry)\n      }\n      const name = String(filter.name || '')\n      const operator = String(filter.filterType || '')\n      const display = (Array.isArray(filter.displayValue) ? filter.displayValue : [])\n        .map((value) => String(value || ''))\n        .filter((value) => value !== '')\n        .slice(0, MAX_VALUES)\n      if (name !== '' && entry.name !== name) { entry.name = name; changed = true }\n      if (operator !== '' && entry.operator !== operator) { entry.operator = operator; changed = true }\n      if (JSON.stringify(entry.values) !== JSON.stringify(values)) { entry.values = values; changed = true }\n      if (display.length > 0 && JSON.stringify(entry.displayValues) !== JSON.stringify(display)) { entry.displayValues = display; changed = true }\n      const applied = values.length > 0\n      if (entry.applied !== applied) { entry.applied = applied; changed = true }\n      const dsId = String(filter.dsId || '')\n      const fdId = String(filter.fdId || '')\n      if (dsId !== '' && !entry.targets.some((target) => String(target.dsId) === dsId && String(target.fdId) === fdId)) {\n        entry.targets.push({ dsId, name, fdId })\n        changed = true\n      }\n    }\n    return changed\n  }\n\n  function netUrl(rawUrl) {\n    try {\n      return new URL(rawUrl, location.href)\n    } catch (_error) {\n      return null\n    }\n  }\n\n  /**\n   * Report one request: a compact inventory line per unique signature\n   * (GETs included — drill/param endpoints may be GET), plus a detailed\n   * JSON-body dump for query-looking endpoints. Card data queries are\n   * always detailed under their own budget: their body IS the state.\n   */\n  function netCapture(method, rawUrl, body) {\n    const url = netUrl(rawUrl)\n    if (url === null || url.origin !== location.origin) return\n    const path = url.pathname\n    if (NET_SKIP_PATH.test(path)) return\n    const bodyText = typeof body === 'string' ? body : ''\n    const isCardData = NET_CARD_DATA_PATH.test(path)\n    // State ingestion is independent of recon budgets: a card query updates\n    // the live selector map even when its body is not worth reporting.\n    if (isCardData && bodyText.charAt(0) === '{' && ingestCardQuery(bodyText)) {\n      schedule()\n    }\n    const query = url.search ? url.search.slice(0, 200) : ''\n    const key = method + ' ' + path + '?' + query + ' #' + String(bodyText.length) + ':' + bodyText.slice(0, 64)\n    if (netState.seen.has(key)) return\n    netState.seen.add(key)\n    if (netState.compact < NET_MAX_COMPACT) {\n      netState.compact += 1\n      console.log(NET_PROBE_PREFIX + JSON.stringify({\n        kind: 'net-req',\n        method,\n        path,\n        ...(query === '' ? {} : { query }),\n        bodyBytes: bodyText.length,\n        at: Date.now(),\n      }))\n    }\n    if (bodyText === '' || bodyText.charAt(0) !== '{') return\n    if (isCardData) {\n      if (netState.cardDetailed >= NET_MAX_CARD_DETAILED) return\n      netState.cardDetailed += 1\n    } else {\n      if (!NET_DETAIL_PATH.test(path) && netState.detailed >= 5) return\n      if (netState.detailed >= NET_MAX_DETAILED) return\n      netState.detailed += 1\n    }\n    console.log(NET_PROBE_PREFIX + JSON.stringify({\n      kind: 'net-req-body',\n      method,\n      path,\n      body: bodyText.slice(0, 11000),\n      truncated: bodyText.length > 11000,\n      at: Date.now(),\n    }).slice(0, 12000))\n  }\n\n  /** Monkey-patch fetch and XHR; originals are restorable via unhookNetwork. */\n  function hookNetwork() {\n    const w = window\n    if (typeof w.fetch === 'function' && w.fetch.__guancliOriginal === undefined) {\n      const original = w.fetch\n      const hooked = function (input, init) {\n        try {\n          const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase()\n          const url = typeof input === 'string' ? input : String((input && input.url) || '')\n          if (method !== 'HEAD') netCapture(method, url, init && init.body)\n        } catch (_error) {}\n        return original.apply(this, arguments)\n      }\n      hooked.__guancliOriginal = original\n      w.fetch = hooked\n    }\n    const proto = typeof XMLHttpRequest === 'function' ? XMLHttpRequest.prototype : null\n    if (proto !== null && proto.__guancliOriginal === undefined) {\n      const open = proto.open\n      const send = proto.send\n      proto.open = function (method, url) {\n        this.__guancliReq = { method: String(method || 'GET').toUpperCase(), url: String(url || '') }\n        return open.apply(this, arguments)\n      }\n      proto.send = function (body) {\n        try {\n          const req = this.__guancliReq\n          if (req && req.method !== 'HEAD') {\n            netCapture(req.method, req.url, typeof body === 'string' ? body : '')\n          }\n        } catch (_error) {}\n        return send.apply(this, arguments)\n      }\n      proto.__guancliOriginal = { open, send }\n    }\n  }\n\n  /** Restore the page's original fetch/XHR (probe upgrade or teardown). */\n  function unhookNetwork() {\n    const w = window\n    if (w.fetch && w.fetch.__guancliOriginal !== undefined) w.fetch = w.fetch.__guancliOriginal\n    const proto = typeof XMLHttpRequest === 'function' ? XMLHttpRequest.prototype : null\n    if (proto !== null && proto.__guancliOriginal !== undefined) {\n      proto.open = proto.__guancliOriginal.open\n      proto.send = proto.__guancliOriginal.send\n      delete proto.__guancliOriginal\n    }\n  }\n  // #endregion\n\n  function publish() {\n    const value = snapshot()\n    if (!ID_PATTERN.test(value.pageId)) return\n    const serialized = JSON.stringify(value)\n    if (serialized !== lastPublished) {\n      lastPublished = serialized\n      console.log('__GUANCLI_DASHBOARD_CONTEXT__' + serialized)\n    }\n    if (value.selectorPrecise !== true && Date.now() - lastDomProbeAt > 30_000) {\n      lastDomProbeAt = Date.now()\n      console.log('__GUANCLI_DOM_PROBE__' + JSON.stringify(domProbe()).slice(0, 16 * 1024))\n    }\n  }\n\n  function schedule() {\n    clearTimeout(timer)\n    timer = setTimeout(publish, 600)\n  }\n\n  const onClick = (event) => {\n    const root = event.target?.closest?.(ROOT_SELECTOR)\n    const id = idFrom(root)\n    if (id) focusedCardId = id\n    // Always re-publish after clicks: canvas DS_ELEMENTS selectors carry no\n    // data-* identity, so the focused-card check above never matches them,\n    // and ant-select applies the new value without a native change event.\n    schedule()\n  }\n  const onDomReady = () => {\n    heartbeat()\n    schedule()\n  }\n  const onMessage = (event) => {\n    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'GUANDATA_DASHBOARD_CONTEXT') return\n    runtimeContext = event.data.context || null\n    schedule()\n  }\n  // Selection changes in canvas filter widgets only mutate the DOM (no\n  // change event, no click on an identified element). A debounced subtree\n  // observer turns those mutations into one republish; publish() diffs the\n  // serialized snapshot, so unrelated re-renders cost nothing.\n  const observer = new MutationObserver(() => schedule())\n  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true })\n  document.addEventListener('click', onClick, true)\n  document.addEventListener('change', schedule, true)\n  document.addEventListener('DOMContentLoaded', onDomReady)\n  window.addEventListener('popstate', schedule)\n  window.addEventListener('hashchange', schedule)\n  window.addEventListener('message', onMessage)\n  globalThis.__guancliDashboardProbe = {\n    version: PROBE_VERSION,\n    stop: () => {\n      clearTimeout(timer)\n      observer.disconnect()\n      document.removeEventListener('click', onClick, true)\n      document.removeEventListener('change', schedule, true)\n      document.removeEventListener('DOMContentLoaded', onDomReady)\n      window.removeEventListener('popstate', schedule)\n      window.removeEventListener('hashchange', schedule)\n      window.removeEventListener('message', onMessage)\n      unhookNetwork()\n    },\n  }\n  hookNetwork()\n  heartbeat()\n  schedule()\n  return 'installed'\n})()";
// __PROBE_SCRIPT_INLINED__

    /** Inlined ask widget (generated from src/ask-widget.js — do not edit by hand; run scripts/sync-ask.mjs). */
    const ASK_SCRIPT = "(() => {\n  const ASK_VERSION = '0.11.0'\n  const existing = globalThis.__guancliAskWidget\n  if (existing && existing.version === ASK_VERSION) return 'already-installed'\n  if (existing && typeof existing.stop === 'function') existing.stop()\n\n  const ASK_PREFIX = '__GUANCLI_PAGE_ASK__'\n  const STYLE = {\n    bubble: 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-radius:20px;background:#0F6FE0;color:#fff;font:13px/1.4 -apple-system,\"PingFang SC\",\"Microsoft YaHei\",sans-serif;box-shadow:0 4px 16px rgba(15,111,224,.35);cursor:pointer;',\n    panel: 'position:fixed;right:16px;bottom:60px;z-index:2147483647;width:320px;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.18);font:13px/1.5 -apple-system,\"PingFang SC\",\"Microsoft YaHei\",sans-serif;color:#1f2329;',\n    title: 'display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:13px;',\n    close: 'border:none;background:none;cursor:pointer;font-size:14px;color:#646a73;padding:0 4px;',\n    area: 'width:100%;min-height:72px;max-height:160px;resize:vertical;padding:8px;border:1px solid #dee0e3;border-radius:8px;font:13px/1.5 inherit;box-sizing:border-box;outline:none;',\n    row: 'display:flex;justify-content:space-between;align-items:center;gap:8px;',\n    status: 'flex:1;font-size:12px;color:#646a73;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',\n    send: 'border:none;border-radius:8px;padding:6px 16px;background:#0F6FE0;color:#fff;font-size:13px;cursor:pointer;',\n  }\n\n  let container = null\n  let panel = null\n  let textarea = null\n  let status = null\n\n  function el(tag, style, text) {\n    const node = document.createElement(tag)\n    node.setAttribute('style', style)\n    if (text !== undefined) node.textContent = text\n    return node\n  }\n\n  /** Ack channel: the plugin Client calls this after delivery. */\n  globalThis.__guancliAskAck = (result) => {\n    if (status === null) return\n    if (result && result.ok === true) {\n      status.textContent = '已发送到主会话，回答请查看 DSH 对话区'\n      if (textarea !== null) textarea.value = ''\n    } else {\n      status.textContent = '发送失败：' + String((result && result.error) || '插件未响应')\n    }\n  }\n\n  function send() {\n    const text = String(textarea?.value ?? '').trim()\n    if (text === '') {\n      status.textContent = '先输入问题'\n      return\n    }\n    console.log(ASK_PREFIX + JSON.stringify({ text, url: location.href, at: Date.now() }))\n    status.textContent = '发送中…'\n  }\n\n  function toggle(show) {\n    if (panel !== null) panel.style.display = show ? 'flex' : 'none'\n    if (show && textarea !== null) textarea.focus()\n  }\n\n  function install() {\n    container = document.createElement('div')\n    container.id = 'guancli-ask-widget'\n\n    const bubble = el('button', STYLE.bubble, '💬 问 Agent')\n    bubble.type = 'button'\n    bubble.addEventListener('click', () => toggle(panel === null || panel.style.display === 'none'))\n\n    panel = el('div', STYLE.panel)\n    panel.style.display = 'none'\n    const title = el('div', STYLE.title)\n    title.appendChild(el('span', '', '向 Agent 提问'))\n    const close = el('button', STYLE.close, '✕')\n    close.type = 'button'\n    close.setAttribute('aria-label', '关闭')\n    close.addEventListener('click', () => toggle(false))\n    title.appendChild(close)\n\n    textarea = el('textarea', STYLE.area)\n    textarea.placeholder = '针对当前看板提问…（Enter 发送，Shift+Enter 换行）'\n    textarea.addEventListener('keydown', (event) => {\n      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {\n        event.preventDefault()\n        send()\n      }\n    })\n\n    const row = el('div', STYLE.row)\n    status = el('span', STYLE.status, '问题会附带当前看板上下文')\n    const button = el('button', STYLE.send, '发送')\n    button.type = 'button'\n    button.addEventListener('click', send)\n    row.appendChild(status)\n    row.appendChild(button)\n\n    panel.appendChild(title)\n    panel.appendChild(textarea)\n    panel.appendChild(row)\n    container.appendChild(bubble)\n    container.appendChild(panel)\n    ;(document.body || document.documentElement).appendChild(container)\n  }\n\n  install()\n  globalThis.__guancliAskWidget = {\n    version: ASK_VERSION,\n    stop: () => {\n      container?.remove()\n      container = null\n      panel = null\n      textarea = null\n      status = null\n      delete globalThis.__guancliAskAck\n    },\n  }\n  return 'installed'\n})()";
// __ASK_SCRIPT_INLINED__

    /**
     * Watch the sidebar webview: inject the dashboard probe into Guandata BI
     * pages and forward captured contexts to the Host. All failures are
     * swallowed — the watcher must never break the page.
     * @param ctx - client root context.
     * @param options - `{ onAsk }` delivery callback for page questions.
     */
    function startDashboardProbe(ctx, options = {}) {
      let probeScript = ''
      let environments = []
      let defaultProfile = null
      let environmentsAt = 0
      let setupPromise = null
      let lastPublished = ''
      let lastContext = null
      const attached = new WeakSet()

      /** Fetch authenticated environments once, cached. The probe script
       * itself is inlined below — probe iterations ship with the client
       * bundle and only need a page refresh, not a Host restart. */
      async function ensureSetup() {
        if (setupPromise !== null) return setupPromise
        setupPromise = (async () => {
          try {
            probeScript = PROBE_SCRIPT
            if (Date.now() - environmentsAt > 5 * 60 * 1000 || environments.length === 0) {
              const envResult = await rpc('environments', {})
              if (Array.isArray(envResult.data?.environments)) {
                environments = envResult.data.environments.filter((entry) => typeof entry?.url === 'string' && entry.url !== '')
                defaultProfile = typeof envResult.data.defaultProfile === 'string' ? envResult.data.defaultProfile : null
                environmentsAt = Date.now()
              }
            }
          } catch (error) {
            console.warn('[guancli-mentions] probe setup failed:', error)
          } finally {
            setupPromise = null
          }
        })()
        return setupPromise
      }

      /** @param webview - an Electron <webview> element. @returns its current URL. */
      function webviewUrl(webview) {
        try {
          if (typeof webview.getURL === 'function') return webview.getURL()
          return String(webview.src || '')
        } catch (_error) {
          return ''
        }
      }

      /** Push one context snapshot to the Host, deduplicated by content. */
      async function publish(context) {
        const serialized = JSON.stringify(context)
        if (serialized === lastPublished) return
        lastPublished = serialized
        lastContext = context
        try {
          await rpc('context.publish', { context })
        } catch (error) {
          console.warn('[guancli-mentions] context publish failed:', error)
        }
      }

      /**
       * Network recon reports arrive in bursts; batch them so each console
       * line does not overwrite the previous one in the Host debug slot.
       */
      const netBuffer = []
      let netFlushTimer = null
      function flushNetReports() {
        netFlushTimer = null
        if (netBuffer.length === 0) return
        const reports = netBuffer.splice(0, netBuffer.length)
        rpc('context.domProbe', { report: { kind: 'net-batch', reports } }).catch((error) => {
          console.warn('[guancli-mentions] net probe upload failed:', error)
        })
      }
      function queueNetReport(report) {
        netBuffer.push(report)
        if (netBuffer.length > 200) netBuffer.shift()
        if (netFlushTimer === null) netFlushTimer = setTimeout(flushNetReports, 3000)
      }

      /** Report the ask-widget delivery outcome back into the page. */
      async function ackAsk(webview, result) {
        try {
          await webview.executeJavaScript(
            'globalThis.__guancliAskAck && globalThis.__guancliAskAck(' + JSON.stringify(result) + ')',
          )
        } catch (_error) {
          // Ack is best-effort; the question was already delivered.
        }
      }

      /** Parse one console line and forward probe output, recon, or questions. */
      function onConsoleMessage(webview, event) {
        const text = String(event?.message ?? '')
        const context = parseProbeOutputText(text)
        if (context !== null) {
          publish(context)
          return
        }
        const ask = parseAskOutputText(text)
        if (ask !== null) {
          if (typeof options.onAsk === 'function') {
            Promise.resolve(options.onAsk(ask, { context: lastContext, environments, defaultProfile }))
              .then((result) => ackAsk(webview, result ?? { ok: true }))
              .catch((error) => ackAsk(webview, { ok: false, error: String(error?.message ?? error).slice(0, 200) }))
          } else {
            ackAsk(webview, { ok: false, error: '提问通道未启用' })
          }
          return
        }
        if (text.startsWith(HEARTBEAT_PREFIX)) {
          try {
            const state = JSON.parse(text.slice(HEARTBEAT_PREFIX.length))
            rpc('context.domProbe', { report: { kind: 'probe-state', heartbeat: state } }).catch(() => {})
          } catch (_error) {}
          return
        }
        if (text.startsWith(NET_PROBE_PREFIX)) {
          try {
            queueNetReport(JSON.parse(text.slice(NET_PROBE_PREFIX.length)))
          } catch (_error) {
            // Malformed network recon line; ignore.
          }
          return
        }
        if (text.startsWith(DOM_PROBE_PREFIX)) {
          try {
            const report = JSON.parse(text.slice(DOM_PROBE_PREFIX.length))
            rpc('context.domProbe', { report }).catch((error) => {
              console.warn('[guancli-mentions] dom probe upload failed:', error)
            })
          } catch (_error) {
            // Malformed recon line; ignore.
          }
        }
      }

      /** Best-effort probe + widget (re-)injection; both self-guard duplicates. */
      async function inject(webview) {
        if (probeScript === '') return
        try {
          await webview.executeJavaScript(probeScript)
        } catch (error) {
          probeState.injectErrors.push(String(error?.message ?? error).slice(0, 200))
          if (probeState.injectErrors.length > 5) probeState.injectErrors.shift()
        }
        if (ASK_SCRIPT !== '') {
          try {
            await webview.executeJavaScript(ASK_SCRIPT)
          } catch (error) {
            probeState.injectErrors.push('ask: ' + String(error?.message ?? error).slice(0, 180))
            if (probeState.injectErrors.length > 5) probeState.injectErrors.shift()
          }
        }
      }

      /** One reload attempt per navigation, for the flaky first-load failure. */
      const retried = new WeakSet()

      /**
       * Self-heal the recurring first-load failure: the Electron error page
       * "文件不存在" (-6) on BI pages always recovers on manual reload, so
       * retry once automatically after a short settle delay.
       */
      function onFailLoad(webview) {
        return (event) => {
          try {
            if (event?.isMainFrame !== true) return
            if (Number(event?.errorCode) !== -6) return
            const url = webviewUrl(webview)
            if (matchEnvironmentName(url, environments) === null) return
            if (retried.has(webview)) return
            retried.add(webview)
            setTimeout(() => {
              try {
                if (typeof webview.reload === 'function') webview.reload()
              } catch (_error) {}
            }, 800)
          } catch (_error) {}
        }
      }

      /** Wire listeners once per webview element, then inject. */
      async function attach(webview) {
        if (attached.has(webview)) return
        attached.add(webview)
        webview.addEventListener('console-message', (event) => onConsoleMessage(webview, event))
        webview.addEventListener('did-navigate', () => { inject(webview) })
        webview.addEventListener('did-navigate-in-page', () => { inject(webview) })
        webview.addEventListener('dom-ready', () => { inject(webview) })
        webview.addEventListener('did-fail-load', onFailLoad(webview))
        await inject(webview)
      }

      /** Last sweep outcome, self-reported through the recon channel. */
      const probeState = { at: 0, probeVersion: '', probeScriptChars: 0, environments: 0, webviews: 0, biWebviews: 0, attached: 0, injectErrors: [] }

      /** Upload the watcher state so the debug channel shows where the pipeline stopped. */
      async function reportState() {
        try {
          await rpc('context.domProbe', { report: { kind: 'probe-state', ...probeState } })
        } catch (_error) {
          // Diagnostics are best-effort.
        }
      }

      /** One sweep: find BI webviews and attach the probe. */
      async function scan() {
        try {
          await ensureSetup()
          probeState.at = Date.now()
          probeState.probeVersion = /PROBE_VERSION = '([^']+)'/.exec(probeScript)?.[1] ?? ''
          probeState.probeScriptChars = probeScript.length
          probeState.environments = environments.length
          if (probeScript === '' || environments.length === 0) {
            await reportState()
            return
          }
          const elements = document.querySelectorAll('webview')
          probeState.webviews = elements.length
          probeState.biWebviews = 0
          probeState.attached = 0
          for (const webview of elements) {
            const env = matchEnvironmentName(webviewUrl(webview), environments)
            if (env === null) continue
            probeState.biWebviews += 1
            await attach(webview)
            if (attached.has(webview)) probeState.attached += 1
          }
          await reportState()
        } catch (error) {
          probeState.injectErrors.push(String(error?.message ?? error).slice(0, 200))
          if (probeState.injectErrors.length > 5) probeState.injectErrors.shift()
          await reportState()
        }
      }

      const interval = setInterval(scan, 2000)
      scan()
      return () => {
        clearInterval(interval)
      }
    }

    return {
      inject: ['locale', 'remote', 'remote.session', 'contextMenus'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
          'guancli-mentions: dictionaries',
        )
        async function continueAfterConfirmation({ sessionId, reference, scope, analysisRequest }) {
          const remote = ctx.remote
          const session = remote && typeof remote === 'object' ? remote.session : undefined
          if (session === undefined || typeof session.prompt !== 'function') {
            throw new Error('当前 DSH 版本不支持会话接口')
          }
          const task = String(analysisRequest ?? '').trim()
          const text = task === ''
            ? `已确认 ${reference} 的数据范围（${scope.summary}）。请按这个范围继续分析。`
            : `${task}\n\n请使用 ${reference}，按已确认的数据范围（${scope.summary}）完成上述分析。`
          await session.prompt({
            requestId: `scope-confirm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        }

        let assetSource
        ctx.inject(['inputTriggers', 'locale', 'slots'], (scope) => {
          const source = createSource(scope, { onConfirmed: continueAfterConfirmation })
          assetSource = source
          scope.effect(
            () => scope.inputTriggers.registerSource(source),
            'guancli-mentions: @ source',
          )
          scope.effect(
            () => scope.slots.inject('conversation.input.overlay', () => scope.slots.register({
              name: 'conversation.input.overlay', id: 'guancli-scope-editor', order: 100,
            }, source.ScopeEditor)),
            'guancli-mentions: scope editor',
          )
          scope.effect(
            () => scope.slots.inject('conversation.chat.userMessageFooter', () => scope.slots.register({
              name: 'conversation.chat.userMessageFooter', id: 'guancli-scope-confirmation', order: 30,
            }, source.ScopeConfirmation)),
            'guancli-mentions: scope confirmation chips',
          )
        })

        /** Resolve the BI URL and reveal it in the sidebar browser. */
        async function openAsset(data) {
          try {
            const result = await rpc('pageUrl', {
              profile: String(data.env || ''),
              assetType: data.type === 'dataset' ? 'dataset' : 'page',
              assetId: String(data.id || ''),
            })
            const url = result.data && result.data.url
            if (typeof url !== 'string' || url === '') {
              console.warn('[guancli-mentions] pageUrl returned no url')
              return
            }
            const sidebarRight = ctx.get('sidebarRight')
            if (sidebarRight === undefined || typeof sidebarRight.openTab !== 'function') {
              console.warn('[guancli-mentions] sidebarRight unavailable')
              return
            }
            sidebarRight.openTab('browser', { params: { url } })
          } catch (error) {
            console.warn('[guancli-mentions] open asset failed:', error)
          }
        }

        ctx.effect(() => {
          const menus = ctx.contextMenus
          if (!menus || typeof menus.register !== 'function') return undefined
          const t = ctx.locale.bind(NS)
          return menus.register({
            target: 'guancli-asset', id: 'guancli-page-actions', order: 0,
            resolve: ({ data, sessionId }) => [
              ...(data.type === 'page' && data.scopeId ? [{
                id: 'adjust-scope', label: t('asset.adjust'),
                run: async () => {
                  if (!assetSource) throw new Error('范围编辑器尚未就绪')
                  await assetSource.scopeEditor.open(sessionId, assetReference(data), { confirm: true, revise: true })
                },
              }] : []),
              { id: 'open-page', label: t('asset.openPage'), run: () => openAsset(data) },
            ],
          })
        }, 'guancli-mentions: asset menu')

        function openAssetMenu(data, sessionId, event) {
          const menus = ctx.contextMenus
          if (!menus || typeof menus.open !== 'function') return openAsset(data)
          event?.preventDefault()
          event?.stopPropagation()
          const rect = event?.currentTarget?.getBoundingClientRect?.()
          menus.open(
            { kind: 'guancli-asset', value: { data, sessionId } },
            { x: rect?.left ?? event?.clientX ?? 0, y: rect?.bottom ?? event?.clientY ?? 0 },
          )
          return undefined
        }

        ctx.inject(['uiConversation', 'slots', 'locale'], (scope) => {
          const t = scope.locale.bind(NS)
          scope.uiConversation.userText.register(assetMentionRule)
          scope.effect(
            () => scope.slots.inject('conversation.user.text.node', () => scope.slots.register({
              name: 'conversation.user.text.node',
              key: 'guancli-asset',
              locale: NS,
              inject: () => ({ openAsset, openMenu: openAssetMenu, t }),
            }, AssetLink)),
            'guancli-mentions: asset link node',
          )
        })

        // #region page ask: capture the live session, deliver page questions.

        /**
         * Invisible ambient entry below the composer: it only stashes the
         * session-scoped props the slot system hands every occupant, so the
         * ask widget can target the conversation the user is looking at.
         */
        function SessionCapture(props) {
          React.useEffect(() => {
            sessionCapture.sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
          })
          return null
        }

        ctx.inject(['slots'], (scope) => {
          scope.effect(
            () => scope.slots.inject('conversation.composer.dock', () => scope.slots.register({
              name: 'conversation.composer.dock',
              id: 'guancli-ask-session',
              order: 90,
              label: 'guancli ask session capture',
            }, SessionCapture)),
            'guancli-mentions: ask session capture',
          )
        })

        /**
         * Build the prompt text: the question plus the dashboard pointer that
         * turns it into a first-class mention (the Host pre-step then injects
         * the asset definition and the live dashboard snapshot by itself).
         */
        function buildAskText(ask, context, env) {
          const lines = [ask.text, '']
          if (context !== null && /^[a-z0-9]{24}$/iu.test(context.pageId) && env !== null) {
            const label = sanitizeLabel(context.pageName) || context.pageId
            lines.push(
              `（上下文：我正在侧边栏浏览器查看看板 @[${label}](dsh-guancli:page:${env}:${context.pageId})，`
              + '请结合当前看板状态回答；需要取数时使用 guancli 工具。）',
            )
          } else {
            lines.push(`（上下文：我正在侧边栏浏览器查看 ${ask.url}，请结合当前看板状态回答。）`)
          }
          return lines.join('\n')
        }

        /**
         * Deliver one page question to the current session through the same
         * remote prompt pipeline the composer uses.
         * @returns the ack result for the in-page widget.
         */
        async function deliverAsk(ask, { context, environments, defaultProfile }) {
          const sessionId = sessionCapture.sessionId
          if (sessionId === '') return { ok: false, error: '未找到当前会话，请先在对话区发一条消息' }
          const remote = ctx.remote
          const session = remote && typeof remote === 'object' ? remote.session : undefined
          if (session === undefined || typeof session.prompt !== 'function') {
            return { ok: false, error: '当前 DSH 版本不支持会话接口' }
          }
          const env = matchEnvironmentName(ask.url, environments, sessionCapture.environment || defaultProfile)
          const requestId = 'pageask-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
          await session.prompt({
            requestId,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text: buildAskText(ask, context ?? null, env) }],
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
          return { ok: true }
        }

        ctx.effect(
          () => startDashboardProbe(ctx, { onAsk: deliverAsk }),
          'guancli-mentions: dashboard probe',
        )

        // #endregion
      },
    }
  },
})
