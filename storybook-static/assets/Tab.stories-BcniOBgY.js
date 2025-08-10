import{j as t}from"./jsx-runtime-D_zvdyIk.js";import{r as c}from"./index-BCtMShv3.js";import{T as o,a as b}from"./Tab-Am_1O7TH.js";const d={title:"Atoms/Tab",component:o,tags:["atoms"]},a=()=>{const[e,i]=c.useState(0);return t.jsx(b,{tabs:[t.jsx(o,{title:"Tab 1",active:e===0,onClick:()=>i(0)},0),t.jsx(o,{title:"Tab 2",active:e===1,onClick:()=>i(1)},1)],children:e===0?t.jsx("div",{children:"Content for Tab 1"}):t.jsx("div",{children:"Content for Tab 2"})})};var r,s,n;a.parameters={...a.parameters,docs:{...(r=a.parameters)==null?void 0:r.docs,source:{originalSource:`() => {
  const [activeTab, setActiveTab] = useState(0);
  return <TabContainer tabs={[<Tab key={0} title="Tab 1" active={activeTab === 0} onClick={() => setActiveTab(0)} />, <Tab key={1} title="Tab 2" active={activeTab === 1} onClick={() => setActiveTab(1)} />]}>
      {activeTab === 0 ? <div>Content for Tab 1</div> : <div>Content for Tab 2</div>}
    </TabContainer>;
}`,...(n=(s=a.parameters)==null?void 0:s.docs)==null?void 0:n.source}}};const m=["Default"];export{a as Default,m as __namedExportsOrder,d as default};
