"""Create trial deployment archives. Does not change a router or contact a server."""
from pathlib import Path
import hashlib, json, tarfile

root=Path(__file__).resolve().parents[1]
version=json.loads((root/"package.json").read_text())["version"]
excluded={".git",".cache","build","test-output","node_modules","__pycache__"}
def included(path):
    parts=path.relative_to(root).parts
    return not any(p in excluded for p in parts) and not (
        path.name.startswith(".env") or path.name.endswith((".mmdb",".mmdb.gz",".tar.gz",".zip",".ucb",".log",".conntrack",".summary.json")))
files=sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and included(p))
output=root/"build"
output.mkdir(exist_ok=True)
collector=["root/usr/sbin/offload-observer","root/usr/share/ucode/offload-observer/core.uc",
    "root/usr/share/ucode/offload-observer/uplink.uc","root/www/luci-static/resources/offload_observer/ui.js",
    "update-collector.sh","capture.sh","COLLECTOR-UPDATE.md","WIFI-UPLINK-UPDATE.md","LICENSE"]
executables={"root/usr/sbin/offload-observer","root/etc/init.d/offload-observer"}
def bundle(label,folder,items):
    archive=output/f"{label}-{version}.tar.gz"
    with tarfile.open(archive,"w:gz",format=tarfile.PAX_FORMAT) as tar:
        for relative in items:
            source=root/relative
            info=tar.gettarinfo(str(source),folder+"/"+relative)
            info.uid=info.gid=0;info.uname=info.gname="root"
            info.mode=0o755 if relative in executables or relative.endswith(".sh") else 0o644
            with source.open("rb") as stream:tar.addfile(info,stream)
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".gz.sha256").write_text(digest+"  "+archive.name+"\n")
    print(archive)
bundle("offload-observer","offload-observer",files)
bundle("offload-observer-collector","offload-observer-collector",collector)
