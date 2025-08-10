import{j as t}from"./jsx-runtime-D_zvdyIk.js";import{a as o}from"./index-B-lxVbXh.js";import{C as r}from"./ClipSelectionDialog-BqZ2LQ6l.js";import"./v4-CtRu48qb.js";import"./Button-Bzr3v68e.js";import"./IconButton-DZr07qzo.js";import"./TimeLink-F3qPxSm4.js";import"./duration-B3hTHHeC.js";const x={title:"Molecules/SelectedCutsDialog",component:r,tags:["molecules"],decorators:[d=>t.jsx("div",{className:"h-[70vh] flex justify-center items-center",children:d()})]},e=()=>t.jsx(r,{clips:[{id:"1",start:0,end:10}],onCopyStartTime:o("onCopyStartTime"),onCopyEndTime:o("onCopyEndTime"),onExport:o("onExport"),show:!0,onClear:o("onClear"),onRemove:o("onRemove"),onReorder:o("onReorder"),onSeekToTime:o("onSeekToTime")}),n=()=>t.jsx(r,{show:!0,clips:[{id:"1",start:0,end:10},{id:"2",start:10,end:20},{id:"3",start:20,end:30}],onCopyStartTime:o("onCopyStartTime"),onCopyEndTime:o("onCopyEndTime"),onExport:o("onExport"),onClear:o("onClear"),onRemove:o("onRemove"),onReorder:o("onReorder"),onSeekToTime:o("onSeekToTime")});var i,a,s;e.parameters={...e.parameters,docs:{...(i=e.parameters)==null?void 0:i.docs,source:{originalSource:`() => {
  return <ClipSelectionDialog clips={[{
    id: "1",
    start: 0,
    end: 10
  }]} onCopyStartTime={action("onCopyStartTime")} onCopyEndTime={action("onCopyEndTime")} onExport={action("onExport")} show={true} onClear={action("onClear")} onRemove={action("onRemove")} onReorder={action("onReorder")} onSeekToTime={action("onSeekToTime")} />;
}`,...(s=(a=e.parameters)==null?void 0:a.docs)==null?void 0:s.source}}};var m,p,c;n.parameters={...n.parameters,docs:{...(m=n.parameters)==null?void 0:m.docs,source:{originalSource:`() => {
  return <ClipSelectionDialog show={true} clips={[{
    id: "1",
    start: 0,
    end: 10
  }, {
    id: "2",
    start: 10,
    end: 20
  }, {
    id: "3",
    start: 20,
    end: 30
  }]} onCopyStartTime={action("onCopyStartTime")} onCopyEndTime={action("onCopyEndTime")} onExport={action("onExport")} onClear={action("onClear")} onRemove={action("onRemove")} onReorder={action("onReorder")} onSeekToTime={action("onSeekToTime")} />;
}`,...(c=(p=n.parameters)==null?void 0:p.docs)==null?void 0:c.source}}};const v=["Default","MultipleCuts"];export{e as Default,n as MultipleCuts,v as __namedExportsOrder,x as default};
