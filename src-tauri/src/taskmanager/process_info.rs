use sysinfo::{Pid, System};

pub struct ProcessManager;

impl ProcessManager {
    pub fn terminate_process(pid: u32) -> bool {
        let mut sys = System::new_all();
        sys.refresh_all();
        if let Some(process) = sys.process(Pid::from_u32(pid)) {
            process.kill()
        } else {
            false
        }
    }
}
