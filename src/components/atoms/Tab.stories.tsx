import { useState } from "react";
import Tab, { TabContainer } from "./Tab";

export default {
  title: "Atoms/Tab",
  component: Tab,
  tags: ["atoms"],
};

export const Default = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <TabContainer
      tabs={[
        <Tab
          key={0}
          title="Tab 1"
          active={activeTab === 0}
          onClick={() => setActiveTab(0)}
        />,
        <Tab
          key={1}
          title="Tab 2"
          active={activeTab === 1}
          onClick={() => setActiveTab(1)}
        />,
      ]}
    >
      {activeTab === 0 ? (
        <div>Content for Tab 1</div>
      ) : (
        <div>Content for Tab 2</div>
      )}
    </TabContainer>
  );
};
