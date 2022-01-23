# react-router 源码阅读

这次的版本是 6.2.1


## 使用

相比较 5.x 版本, <Switch>元素升级为了<Routes>

简单的 v6 例子:

```jsx
function App(){
    return  <BrowserRouter>
        <Routes>
            <Route path="/about" element={<About/>}/>
            <Route path="/users" element={<Users/>}/>
            <Route path="/" element={<Home/>}/>
        </Routes>
    </BrowserRouter>
}
```

## context

在 react-router 中, 他创建了两个 context 供后续的使用, 当然这两个 context 是在内部的, 并没有 API 暴露出来

### NavigationContext

```tsx
/**
 * 一个路由对象的基本构成
 */
export interface RouteObject {
    caseSensitive?: boolean;
    children?: RouteObject[];
    element?: React.ReactNode;
    index?: boolean;
    path?: string;
}

// 常用的参数类型
export type Params<Key extends string = string> = {
    readonly [key in Key]: string | undefined;
};

/**
 * 一个 路由匹配 接口
 */
export interface RouteMatch<ParamKey extends string = string> {
    /**
     * 动态参数的名称和值的URL
     */
    params: Params<ParamKey>;
    /**
     * 路径名
     */
    pathname: string;
    /**
     * 之前匹配的路径名
     */
    pathnameBase: string;
    /**
     * 匹配到的路由对象
     */
    route: RouteObject;
}

interface RouteContextObject {
    outlet: React.ReactElement | null;
    matches: RouteMatch[];
}

const RouteContext = React.createContext<RouteContextObject>({
    outlet: null,
    matches: []
});
```

### LocationContext

```tsx
import type {
    Location,
    Action as NavigationType
} from "history";

interface LocationContextObject {
    location: Location; // 原生的 location 对象, window.location

    /**
     * enum Action 一个枚举, 他有三个参数, 代表路由三种动作
     * Pop = "POP",
     * Push = "PUSH",
     * Replace = "REPLACE"
     */
    navigationType: NavigationType;  
}

const LocationContext = React.createContext<LocationContextObject>(null!);

```

## MemoryRouter

在 `react-router-dom` 的源码解析中我们说到了 `BrowserRouter` 和 `HashRouter`, 那么这个 `MemoryRouter`又是什么呢

他是将 URL 的历史记录保存在内存中的 <Router>（不读取或写入地址栏）。在测试和非浏览器环境中很有用，例如 React Native。

他的源码和其他两个 Router 最大的区别就是一个 `createMemoryHistory` 方法, 此方法也来自于 `history` 库中
```tsx
export function MemoryRouter({
                                 basename,
                                 children,
                                 initialEntries,
                                 initialIndex
                             }: MemoryRouterProps): React.ReactElement {
    let historyRef = React.useRef<MemoryHistory>();
    if (historyRef.current == null) {
        historyRef.current = createMemoryHistory({ initialEntries, initialIndex });
    }

    let history = historyRef.current;
    let [state, setState] = React.useState({
        action: history.action,
        location: history.location
    });

    React.useLayoutEffect(() => history.listen(setState), [history]);

    return (
        <Router
            basename={basename}
            children={children}
            location={state.location}
            navigationType={state.action}
            navigator={history}
        />
    );
}
```

那我们现在来看一看这个方法, 这里只讲他与 `createHashHistory` 不同的地方:

```tsx
export function createMemoryHistory(
  options: MemoryHistoryOptions = {}
): MemoryHistory {
  let { initialEntries = ['/'], initialIndex } = options; // 不同的初始值 initialEntries
  let entries: Location[] = initialEntries.map((entry) => {
    let location = readOnly<Location>({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: createKey(), // 通过 random 生成唯一值
      ...(typeof entry === 'string' ? parsePath(entry) : entry)
    }); // 这里的 location 属于是直接创建, HashHistory 中是使用的 window.location
      // readOnly方法 可以看做 (obj)=>obj, 并没有太大作用
    return location;
  });
 

  function push(to: To, state?: any) {
    let nextAction = Action.Push;
    let nextLocation = getNextLocation(to, state);
    function retry() {
      push(to, state);
    }

    // 忽略其他类似的代码
    
    if (allowTx(nextAction, nextLocation, retry)) {
      index += 1;
      // 别处是调用原生 API, history.pushState
      entries.splice(index, entries.length, nextLocation);
      applyTx(nextAction, nextLocation);
    }
  }

  
  // 与 push 类似, 忽略 replace

  function go(delta: number) {
      // 与HashHistory不同, 也是走的类似 push
    let nextIndex = clamp(index + delta, 0, entries.length - 1);
    let nextAction = Action.Pop;
    let nextLocation = entries[nextIndex];
    function retry() {
      go(delta);
    }

    if (allowTx(nextAction, nextLocation, retry)) {
      index = nextIndex;
      applyTx(nextAction, nextLocation);
    }
  }

  let history: MemoryHistory = {
    // 基本相同
  };

  return history;
}
```

## Navigate

用来改变 当然 location 的方法, 是一个 react-router 抛出的 API

### 使用方式:


```jsx

function App() {
    // 一旦 user 是有值的, 就跳转至 `/dashboard` 页面了
    // 算是跳转路由的一种方案
    return <div>
        {user && (
            <Navigate to="/dashboard" replace={true} />
        )}
        <form onSubmit={event => this.handleSubmit(event)}>
            <input type="text" name="username" />
            <input type="password" name="password" />
        </form>
    </div>
}
```

### 源码

```tsx

export function Navigate({ to, replace, state }: NavigateProps): null {
    // 直接调用 useNavigate 来获取 navigate 方法, 并且  useEffect 每次都会触发
    // useNavigate 源码在下方会讲到
    let navigate = useNavigate();
    React.useEffect(() => {
        navigate(to, { replace, state });
    });

    return null;
}

```




## Outlet

用来渲染子路由的元素, 简单来说就是一个路由的占位符

代码很简单, 使用的逻辑是这样

### 使用方式:

```jsx

function App(props) {
    return (
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<Dashboard></Dashboard>}>
                    <Route path="qqwe" element={<About/>}/>
                    <Route path="about" element={<About/>}/>
                    <Route path="users" element={<Users/>}/>
                </Route>
            </Routes>
        </HashRouter>
    );
}

// 其中外层的Dashboard:

function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <Outlet />
            // 这里就会渲染他的子路由了
            // 和以前 children 差不多
        </div>
    );
}
```

### 源码

```tsx
export function Outlet(props: OutletProps): React.ReactElement | null {
    return useOutlet(props.context);
}

export function useOutlet(context?: unknown): React.ReactElement | null {
    let outlet = React.useContext(RouteContext).outlet;
    if (outlet) {
        return (
            <OutletContext.Provider value={context}>{outlet}</OutletContext.Provider>
        );
    }
    return outlet;
}
```



## useParams
从当前URL所匹配的路径中, 返回一个对象的键/值对的动态参数。

```tsx
function useParams<
    ParamsOrKey extends string | Record<string, string | undefined> = string
    >(): Readonly<
    [ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>
    > {
    // 直接获取了 RouteContext 中 matches 数组的最后一个对象, 如果没有就是空对象
    let { matches } = React.useContext(RouteContext);
    let routeMatch = matches[matches.length - 1];
    return routeMatch ? (routeMatch.params as any) : {};
}
```


## useResolvedPath

将给定的`to'值的路径名与当前位置进行比较

在 `<NavLink>` 这个组件中使用到

```tsx
function useResolvedPath(to: To): Path {
    let { matches } = React.useContext(RouteContext);
    let { pathname: locationPathname } = useLocation();
    
    // 合并成一个 json 字符, 至于为什么又要解析, 是为了添加字符层的缓存, 如果是一个对象, 就不好浅比较了
    let routePathnamesJson = JSON.stringify(
        matches.map(match => match.pathnameBase)
    );
    
    // TODO resolveTo
    return React.useMemo(
        () => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname),
        [to, routePathnamesJson, locationPathname]
    );
}
```

## useRoutes

useRoutes钩子的功能等同于<Routes>，但它使用JavaScript对象而不是<Route>元素来定义路由。
相当于是一种 schema 版本, 更好的配置性


### 使用方式:

如果使用过 umi, 是不是会感觉到一模一样

```tsx
function App() {
  let element = useRoutes([
    { path: "/", element: <Home /> },
    { path: "dashboard", element: <Dashboard /> },
    {
      path: "invoices",
      element: <Invoices />,
      children: [
        { path: ":id", element: <Invoice /> },
        { path: "sent", element: <SentInvoices /> }
      ]
    },
    { path: "*", element: <NotFound /> }
  ]);

  return element;
}
```

### 源码

```tsx
// 具体的 routes 对象是如何生成的, 下面的 Routes-createRoutesFromChildren 会讲到

export function useRoutes(
    routes: RouteObject[],
    locationArg?: Partial<Location> | string
): React.ReactElement | null {
    
    let { matches: parentMatches } = React.useContext(RouteContext);
    let routeMatch = parentMatches[parentMatches.length - 1];
    // 获取匹配的 route
    
    let parentParams = routeMatch ? routeMatch.params : {};
    let parentPathname = routeMatch ? routeMatch.pathname : "/";
    let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
    let parentRoute = routeMatch && routeMatch.route;
    // 这里上面都是一些参数, 没有就是默认值
    
    //  等于 React.useContext(LocationContext).location, 约等于原生的 location
    let locationFromContext = useLocation();

    let location;
    if (locationArg) { // 对于配置项参数的一些判断
        let parsedLocationArg =
            typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
        location = parsedLocationArg;
    } else {
        location = locationFromContext;
    }
    // 如果参数里有则使用参数里的, 如果没有使用 context 的
    

    let pathname = location.pathname || "/";
    let remainingPathname =
        parentPathnameBase === "/"
            ? pathname
            : pathname.slice(parentPathnameBase.length) || "/";
    // matchRoutes 大概的作用是通过pathname遍历寻找,匹配到的路由    具体源码放在下面讲
    let matches = matchRoutes(routes, { pathname: remainingPathname });

    
    // 最后调用渲染函数  首先对数据进行 map
    // joinPaths  的作用约等于 paths.join("/") 并且去除多余的斜杠
    return _renderMatches(
        matches &&
        matches.map(match =>
            Object.assign({}, match, {
                params: Object.assign({}, parentParams, match.params),
                pathname: joinPaths([parentPathnameBase, match.pathname]),
                pathnameBase:
                    match.pathnameBase === "/"
                        ? parentPathnameBase
                        : joinPaths([parentPathnameBase, match.pathnameBase])
            })
        ),
        parentMatches
    );
}
```


### useRoutes-matchRoutes

```tsx
function matchRoutes(
    routes: RouteObject[],
    locationArg: Partial<Location> | string,
    basename = "/"
): RouteMatch[] | null {
    let location =
        typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

    // 获取排除 basename 的 pathname
    let pathname = stripBasename(location.pathname || "/", basename);

    if (pathname == null) {
        return null;
    }

    // flattenRoutes 函数的主要作用, 压平 routes, 方便遍历
    // 源码见下方
    let branches = flattenRoutes(routes);
    
    // 对路由进行排序
    // rankRouteBranches 源码见下方
    rankRouteBranches(branches);

    
    // 筛选出匹配到的路由 matchRouteBranch源码在下面讲
    let matches = null;
    for (let i = 0; matches == null && i < branches.length; ++i) {
        matches = matchRouteBranch(branches[i], pathname);
    }

    return matches;
}
```


#### useRoutes-matchRoutes-stripBasename

拆分 basename, 代码很简单, 这里就直接贴出来了

```tsx
function stripBasename(pathname: string, basename: string): string | null {
    if (basename === "/") return pathname;

    if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
        return null;
    }

    let nextChar = pathname.charAt(basename.length);
    if (nextChar && nextChar !== "/") {
        return null;
    }

    return pathname.slice(basename.length) || "/";
}
```

#### useRoutes-matchRoutes-flattenRoutes

递归处理 routes, 压平 routes 

```tsx
function flattenRoutes(
    routes: RouteObject[],
    branches: RouteBranch[] = [],
    parentsMeta: RouteMeta[] = [],
    parentPath = ""
): RouteBranch[] {
    routes.forEach((route, index) => {
        let meta: RouteMeta = {
            relativePath: route.path || "",
            caseSensitive: route.caseSensitive === true,
            childrenIndex: index,
            route
        };

        if (meta.relativePath.startsWith("/")) {
            meta.relativePath = meta.relativePath.slice(parentPath.length);
        }
        
        // joinPaths 源码: (paths)=>paths.join("/").replace(/\/\/+/g, "/")
        // 把数组转成字符串, 并且清除重复斜杠
        let path = joinPaths([parentPath, meta.relativePath]);
        let routesMeta = parentsMeta.concat(meta);

        // 如果有子路由则递归
        if (route.children && route.children.length > 0) {
            flattenRoutes(route.children, branches, routesMeta, path);
        }

        // 匹配不到就 return
        if (route.path == null && !route.index) {
            return;
        }
        // 压平后组件添加的对象, TODO computeScore
        branches.push({ path, score: computeScore(path, route.index), routesMeta });
    });

    return branches;
}
```

#### useRoutes-matchRoutes-rankRouteBranches

对路由进行排序, 这里可以略过,不管排序算法如何, 只需要知道, 知道输入的值是经过一系列排序的就行

```tsx
function rankRouteBranches(branches: RouteBranch[]): void {
    branches.sort((a, b) =>
        a.score !== b.score
            ? b.score - a.score // Higher score first
            : compareIndexes(
                a.routesMeta.map(meta => meta.childrenIndex),
                b.routesMeta.map(meta => meta.childrenIndex)
            )
    );
}
```

#### useRoutes-matchRoutes-matchRouteBranch

匹配函数, 接受参数 branch 就是某一个 rankRouteBranches

```tsx
function matchRouteBranch<ParamKey extends string = string>(
    branch: RouteBranch,
    pathname: string
): RouteMatch<ParamKey>[] | null {
    let { routesMeta } = branch;

    let matchedParams = {};
    let matchedPathname = "/";
    let matches: RouteMatch[] = [];
    
    //  routesMeta 详细来源可以查看 上面的flattenRoutes
    for (let i = 0; i < routesMeta.length; ++i) {
        let meta = routesMeta[i];
        let end = i === routesMeta.length - 1;
        let remainingPathname =
            matchedPathname === "/"
                ? pathname
                : pathname.slice(matchedPathname.length) || "/";
        
        // 比较, matchPath 源码在下方
        let match = matchPath(
            { path: meta.relativePath, caseSensitive: meta.caseSensitive, end },
            remainingPathname
        );

        // 如果返回是空 则直接返回
        if (!match) return null;

        // 更换对象源
        Object.assign(matchedParams, match.params);

        let route = meta.route;
        
        // push 到最终结果上, joinPaths 不再赘述
        matches.push({
            params: matchedParams,
            pathname: joinPaths([matchedPathname, match.pathname]),
            pathnameBase: joinPaths([matchedPathname, match.pathnameBase]),
            route
        });

        if (match.pathnameBase !== "/") {
            matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
        }
    }

    return matches;
}
```

#### useRoutes-matchRoutes-matchRouteBranch-matchPath

对一个URL路径名进行模式匹配，并返回有关匹配的信息。
他也是一个保留在外的可用 API

```tsx
export function matchPath<
    ParamKey extends ParamParseKey<Path>,
    Path extends string
    >(
    pattern: PathPattern<Path> | Path,
    pathname: string
): PathMatch<ParamKey> | null {
    // pattern 的重新赋值
    if (typeof pattern === "string") {
        pattern = { path: pattern, caseSensitive: false, end: true };
    }

    // 通过正则匹配返回匹配到的正则表达式   matcher 为 RegExp
    let [matcher, paramNames] = compilePath(
        pattern.path,
        pattern.caseSensitive,
        pattern.end
    );

    // 正则对象的 match 方法
    let match = pathname.match(matcher);
    if (!match) return null;

    // 取 match 到的值
    let matchedPathname = match[0];
    let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
    let captureGroups = match.slice(1);
    
    // params 转成对象  { param:value, ... }
    let params: Params = paramNames.reduce<Mutable<Params>>(
        (memo, paramName, index) => {
            // 如果是*号  转换
            if (paramName === "*") {
                let splatValue = captureGroups[index] || "";
                pathnameBase = matchedPathname
                    .slice(0, matchedPathname.length - splatValue.length)
                    .replace(/(.)\/+$/, "$1");
            }

            // safelyDecodeURIComponent  等于 decodeURIComponent + try_catch
            memo[paramName] = safelyDecodeURIComponent(
                captureGroups[index] || "",
                paramName
            );
            return memo;
        },
        {}
    );

    return {
        params,
        pathname: matchedPathname,
        pathnameBase,
        pattern
    };
}

```


#### useRoutes-matchRoutes-matchRouteBranch-matchPath-compilePath

```tsx

function compilePath(
    path: string,
    caseSensitive = false,
    end = true
): [RegExp, string[]] {
    let paramNames: string[] = [];
    // 正则匹配替换
    let regexpSource =
        "^" +
        path
            // 忽略尾随的 / 和 /*
            .replace(/\/*\*?$/, "")
            // 确保以 / 开头
            .replace(/^\/*/, "/") 
            // 转义特殊字符
            .replace(/[\\.*+^$?{}|()[\]]/g, "\\$&") // Escape special regex chars
            .replace(/:(\w+)/g, (_: string, paramName: string) => {
                paramNames.push(paramName);
                return "([^\\/]+)";
            });

    // 对于*号的特别判断
    if (path.endsWith("*")) {
        paramNames.push("*");
        regexpSource +=
            path === "*" || path === "/*"
                ? "(.*)$" // Already matched the initial /, just match the rest
                : "(?:\\/(.+)|\\/*)$"; // Don't include the / in params["*"]
    } else {
        regexpSource += end
            ? "\\/*$" // 匹配到末尾时，忽略尾部斜杠
            : 
            "(?:\\b|\\/|$)";
    }

    let matcher = new RegExp(regexpSource, caseSensitive ? undefined : "i");
    
    // 返回匹配结果
    return [matcher, paramNames];
}

```


### useRoutes-_renderMatches

渲染匹配到的路由

```tsx
function _renderMatches(
    matches: RouteMatch[] | null,
    parentMatches: RouteMatch[] = []
): React.ReactElement | null {
    
    if (matches == null) return null;
    
    // 通过 context 传递数据
    return matches.reduceRight((outlet, match, index) => {
        return (
            <RouteContext.Provider
                children={
                    match.route.element !== undefined ? match.route.element : <Outlet />
                }
                value={{
                    outlet,
                    matches: parentMatches.concat(matches.slice(0, index + 1))
                }}
            />
        );
    }, null as React.ReactElement | null);
}
```


## Router

为应用程序的其他部分提供context信息

通常不会使用此组件, 他是 MemoryRouter 最终渲染的组件

在 react-router-dom 库中, 也是 BrowserRouter 和 HashRouter 的最终渲染组件

```tsx
export function Router({
                           basename: basenameProp = "/",
                           children = null,
                           location: locationProp,
                           navigationType = NavigationType.Pop,
                           navigator,
                           static: staticProp = false
                       }: RouterProps): React.ReactElement | null {

    // 格式化 baseName 
    let basename = normalizePathname(basenameProp);
    
    // memo context value
    let navigationContext = React.useMemo(
        () => ({ basename, navigator, static: staticProp }),
        [basename, navigator, staticProp]
    );

    // 如果是字符串则解析  根据 #, ? 特殊符号解析 url
    if (typeof locationProp === "string") {
        locationProp = parsePath(locationProp);
    }

    let {
        pathname = "/",
        search = "",
        hash = "",
        state = null,
        key = "default"
    } = locationProp;

    // 同样的缓存
    let location = React.useMemo(() => {
        // 这还方法在 useRoutes-matchRoutes-stripBasename 讲过这里就不多说
        let trailingPathname = stripBasename(pathname, basename);

        if (trailingPathname == null) {
            return null;
        }

        return {
            pathname: trailingPathname,
            search,
            hash,
            state,
            key
        };
    }, [basename, pathname, search, hash, state, key]);

    // 空值判断
    if (location == null) {
        return null;
    }

    // 提供 context 的 provider, 传递 children
    return (
        <NavigationContext.Provider value={navigationContext}>
            <LocationContext.Provider
                children={children}
                value={{ location, navigationType }}
            />
        </NavigationContext.Provider>
    );
}
```



## parsePath

此源码来自于 history 仓库

```tsx
function parsePath(path: string): Partial<Path> {
  let parsedPath: Partial<Path> = {};

  // 首先确定 path
  if (path) {
      // 是否有#号 , 如果有则截取
    let hashIndex = path.indexOf('#');
    if (hashIndex >= 0) {
      parsedPath.hash = path.substr(hashIndex);
      path = path.substr(0, hashIndex);
    }

    // 再判断 ? , 有也截取
    let searchIndex = path.indexOf('?');
    if (searchIndex >= 0) {
      parsedPath.search = path.substr(searchIndex);
      path = path.substr(0, searchIndex);
    }

    // 最后就是 path
    if (path) {
      parsedPath.pathname = path;
    }
  }
// 返回结果
  return parsedPath;
}
```

## Routes

用来包裹 route 的元素, 主要是通过 useRoutes 的逻辑

```tsx
 function Routes({
                           children,
                           location
                       }: RoutesProps): React.ReactElement | null {
    return useRoutes(createRoutesFromChildren(children), location);
}
```

## Routes-createRoutesFromChildren

接收到的参数一般都是 Route children, 可能是多层嵌套的, 最后得的我们定义的 route 组件结构,
它将被传递给 useRoutes 函数

```tsx
function createRoutesFromChildren(
    children: React.ReactNode
): RouteObject[] {
    let routes: RouteObject[] = [];

    // 使用官方函数循环
    React.Children.forEach(children, element => {
        if (element.type === React.Fragment) {
            // 如果是 React.Fragment 组件 则直接push 递归函数
            routes.push.apply(
                routes,
                createRoutesFromChildren(element.props.children)
            );
            return;
        }
        
        let route: RouteObject = {
            caseSensitive: element.props.caseSensitive,
            element: element.props.element,
            index: element.props.index,
            path: element.props.path
        }; // route 对象具有的属性
        
        // 同样地递归
        if (element.props.children) {
            route.children = createRoutesFromChildren(element.props.children);
        }

        routes.push(route);
    });

    return routes;
}

```


## useHref

返回完整的链接

```tsx
export function useHref(to: To): string {
    let { basename, navigator } = React.useContext(NavigationContext);
    // useResolvedPath 在上面讲过
    let { hash, pathname, search } = useResolvedPath(to);

    let joinedPathname = pathname;
    if (basename !== "/") {
        let toPathname = getToPathname(to);
        let endsWithSlash = toPathname != null && toPathname.endsWith("/");
        joinedPathname =
            pathname === "/"
                ? basename + (endsWithSlash ? "/" : "")
                : joinPaths([basename, pathname]);
    }

    // 可以看做, 路由的拼接, 包括 ? , #
    return navigator.createHref({ pathname: joinedPathname, search, hash });
}

```

## resolveTo


```tsx
function resolveTo(
    toArg: To,
    routePathnames: string[],
    locationPathname: string
): Path {
    // parsePath上面已经分析过了
    let to = typeof toArg === "string" ? parsePath(toArg) : toArg;
    let toPathname = toArg === "" || to.pathname === "" ? "/" : to.pathname;

    let from: string;
    if (toPathname == null) {
        from = locationPathname;
    } else {
        let routePathnameIndex = routePathnames.length - 1;

        // 如果以 .. 开始的路径
        if (toPathname.startsWith("..")) {
            let toSegments = toPathname.split("/");

            // 去除 ..
            while (toSegments[0] === "..") {
                toSegments.shift();
                routePathnameIndex -= 1;
            }

            to.pathname = toSegments.join("/");
        }

        // from 复制
        from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
    }

    // 解析, 返回对象
    let path = resolvePath(to, from);

    if (
        toPathname &&
        toPathname !== "/" &&
        toPathname.endsWith("/") &&
        !path.pathname.endsWith("/")
    ) {
        path.pathname += "/";
    }
    // 确保加上末尾 /

    return path;
}
```

### resolveTo-resolvePath

返回一个相对于给定路径名的解析路径对象, 这里的函数也基本都讲过

```tsx
function resolvePath(to: To, fromPathname = "/"): Path {
    let {
        pathname: toPathname,
        search = "",
        hash = ""
    } = typeof to === "string" ? parsePath(to) : to;

    let pathname = toPathname
        ? toPathname.startsWith("/")
            ? toPathname
            // resolvePathname
            : resolvePathname(toPathname, fromPathname)
        : fromPathname;

    return {
        pathname,
        search: normalizeSearch(search),
        hash: normalizeHash(hash)
    };
}
```

### resolveTo-resolvePath-resolvePathname

```tsx
function resolvePathname(relativePath: string, fromPathname: string): string {
    // 去除末尾斜杠, 再以斜杠分割成数组
    let segments = fromPathname.replace(/\/+$/, "").split("/");
    let relativeSegments = relativePath.split("/");

    relativeSegments.forEach(segment => {
        if (segment === "..") {
            // 移除 ..
            if (segments.length > 1) segments.pop();
        } else if (segment !== ".") {
            segments.push(segment);
        }
    });

    return segments.length > 1 ? segments.join("/") : "/";
}
```

## useLocation useNavigationType

```tsx
function useLocation(): Location {
    // 只是获取 context 中的数据
    return React.useContext(LocationContext).location;
}
```

同上

```tsx
function useNavigationType(): NavigationType {
    return React.useContext(LocationContext).navigationType;
}
```

## useMatch

```tsx

function useMatch<
    ParamKey extends ParamParseKey<Path>,
    Path extends string
    >(pattern: PathPattern<Path> | Path): PathMatch<ParamKey> | null {
    // 获取 location.pathname
    let { pathname } = useLocation();
    // matchPath  在 useRoutes-matchRoutes-matchRouteBranch-matchPath 中讲到过
    // 对一个URL路径名进行模式匹配，并返回有关匹配的信息。
    return React.useMemo(
        () => matchPath<ParamKey, Path>(pattern, pathname),
        [pathname, pattern]
    );
}
```

## useNavigate

```tsx
function useNavigate(): NavigateFunction {
    let { basename, navigator } = React.useContext(NavigationContext);
    let { matches } = React.useContext(RouteContext);
    let { pathname: locationPathname } = useLocation();
    let routePathnamesJson = JSON.stringify(
        matches.map(match => match.pathnameBase)
    );
    let activeRef = React.useRef(false);
    React.useEffect(() => {
        activeRef.current = true;
    });
    let navigate: NavigateFunction = React.useCallback(
        (to: To | number, options: NavigateOptions = {}) => {
            warning(
                activeRef.current,
                `You should call navigate() in a React.useEffect(), not when ` +
                `your component is first rendered.`
            );
            if (!activeRef.current) return;
            if (typeof to === "number") {
                navigator.go(to);
                return;
            }
            let path = resolveTo(
                to,
                JSON.parse(routePathnamesJson),
                locationPathname
            );
            if (basename !== "/") {
                path.pathname = joinPaths([basename, path.pathname]);
            }
            (!!options.replace ? navigator.replace : navigator.push)(
                path,
                options.state
            );
        },
        [basename, navigator, routePathnamesJson, locationPathname]
    );
    return navigate;
}
```

## generatePath

## computeScore
