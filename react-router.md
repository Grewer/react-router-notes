# react-router 源码阅读

这次的版本是 6.0.2


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
