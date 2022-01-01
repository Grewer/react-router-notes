import './App.css';
import {BrowserRouter, HashRouter, Outlet, Route, Routes, useLocation, useSearchParams} from "./react-router-dom";
import {useNavigate} from "./react-router";


function App(props) {

    console.log('App1', props)

    return (
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<Dashboard></Dashboard>}>
                    <Route path="qqwe" element={<About/>}/>
                    <Route path="/about" element={<About/>}/>
                    <Route path="/users" element={<Users/>}/>
                </Route>

                {/*<Route path="/" element={<Home/>}/>*/}
            </Routes>
        </HashRouter>
    );
}


function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <Outlet />
        </div>
    );
}


function Home() {
    let nav = useNavigate();
    return <div>
        <h2>Home</h2>
        <button onClick={(ev)=>{
            console.log(ev)
            nav('/users')
        }}>users</button>
    </div>;
}

function About() {
    let [searchParams, setSearchParams] = useSearchParams();
    console.log(searchParams, setSearchParams)
    console.log(searchParams.get("q"))
    console.log(searchParams.toString())

    return <h2>
        About
    <button onClick={()=>{
        setSearchParams({q:'qwe'})
    }
    }>test</button>
    </h2>;
}

function Users() {
    return <h2>Users</h2>;
}


export default App;
