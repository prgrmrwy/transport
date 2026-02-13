import DeviceList from "../components/DeviceList";
import FileBrowser from "../components/FileBrowser";

export default function HomePage() {
  return (
    <div className="flex h-full">
      <DeviceList />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FileBrowser />
      </div>
    </div>
  );
}
