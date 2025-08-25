#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional


def ensure_utf8_output():
    """
    综合 UTF-8 设置，适用于 Windows 钩子环境。
    修复 Claude Code 钩子中文字符乱码问题。
    """
    if sys.platform.startswith("win"):
        # 方法1: 设置环境变量为 UTF-8
        os.environ["PYTHONIOENCODING"] = "utf-8"
        os.environ["PYTHONLEGACYWINDOWSSTDIO"] = "0"

        # 方法2: 尝试设置控制台代码页为 UTF-8
        try:
            import subprocess

            subprocess.run(["chcp", "65001"], shell=True, capture_output=True)
        except Exception:
            pass

        # 方法3: 强制 UTF-8 编码输出
        import codecs

        try:
            # 重新配置 stdout 和 stderr 使用 UTF-8
            if hasattr(sys.stdout, "detach"):
                sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
            if hasattr(sys.stderr, "detach"):
                sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())
        except Exception:
            # 备用方案
            try:
                sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
                sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)
            except Exception:
                pass


def normalize_paths_in_json(json_text: str) -> str:
    """
    规范化 JSON 文本中的 Windows 路径，使用正斜杠。
    避免反斜杠转义序列问题。
    """
    # 匹配 Windows 风格路径的模式
    windows_path_pattern = r'"([A-Za-z]:\\\\[^"]*)"'

    def replace_path(match):
        path = match.group(1)
        # 将双反斜杠替换为正斜杠
        normalized_path = path.replace("\\\\", "/")
        # 处理单反斜杠
        normalized_path = normalized_path.replace("\\", "/")
        return f'"{normalized_path}"'

    # 应用替换
    normalized_text = re.sub(windows_path_pattern, replace_path, json_text)

    # 处理 UNC 路径
    unc_pattern = r'"(\\\\\\\\[^"]*)"'

    def replace_unc_path(match):
        path = match.group(1)
        normalized_path = path.replace("\\\\\\\\", "//")
        normalized_path = normalized_path.replace("\\\\", "/")
        normalized_path = normalized_path.replace("\\", "/")
        return f'"{normalized_path}"'

    normalized_text = re.sub(unc_pattern, replace_unc_path, normalized_text)
    return normalized_text


class DiagnosticsChecker:
    """VS Code 诊断信息检查器"""

    SEVERITY_MAP = {0: "Error", 1: "Warning", 2: "Information", 3: "Hint"}
    SEVERITY_ICONS = {"Error": "❌", "Warning": "⚠️", "Information": "ℹ️", "Hint": "💡"}

    def __init__(self) -> None:
        self.diagnostics_file = self._locate_diagnostics_file()

    def _locate_diagnostics_file(self) -> Optional[Path]:
        """定位项目根目录下的 vscode-diagnostics.json"""
        # 尝试多个可能的路径
        possible_paths = [
            # 方法1：基于脚本位置推断
            Path(__file__).parent.parent.parent / "vscode-diagnostics.json",
            # 方法2：当前工作目录
            Path.cwd() / "vscode-diagnostics.json",
            # 方法3：环境变量指定的项目目录
            Path(os.environ.get("CLAUDE_PROJECT_DIR", ".")) / "vscode-diagnostics.json",
        ]

        for json_file in possible_paths:
            if json_file.exists():
                return json_file.resolve()
        return None

    def load_diagnostics(self) -> List[Dict[str, Any]]:
        """加载诊断数据，带重试机制"""
        if not self.diagnostics_file:
            return []

        # 重试机制：最多尝试5次，每次间隔1秒
        for attempt in range(5):
            try:
                # 检查文件是否存在且可读
                if not self.diagnostics_file.exists():
                    time.sleep(1)
                    continue

                # 检查文件大小，避免读取正在写入的文件
                file_size = self.diagnostics_file.stat().st_size
                if file_size == 0:
                    time.sleep(1)
                    continue

                # 尝试读取文件
                with self.diagnostics_file.open(encoding="utf-8") as f:
                    content = f.read().strip()
                    if not content:
                        time.sleep(1)
                        continue
                    return json.loads(content)

            except (json.JSONDecodeError, OSError, PermissionError) as e:
                if attempt < 4:  # 不是最后一次尝试
                    time.sleep(1)
                    continue
                # 最后一次尝试失败，记录错误但不中断
                print(f"诊断文件读取失败 (尝试 {attempt+1}/5): {e}", file=sys.stderr)

        return []

    def analyze_statistics(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """分析诊断统计信息"""
        total_files, total_diagnostics = 0, 0
        severity_count: Counter[str] = Counter()

        for file_data in data:
            total_files += 1
            diagnostics = file_data.get("diagnostics", [])
            total_diagnostics += len(diagnostics)
            for diag in diagnostics:
                sev = self.SEVERITY_MAP.get(diag.get("severity", 0), "Unknown")
                severity_count[sev] += 1

        return {
            "total_files": total_files,
            "total_diagnostics": total_diagnostics,
            "by_severity": dict(severity_count),
        }

    @staticmethod
    def _project_root() -> Path:
        """获取项目根目录"""
        return Path(__file__).parent.parent.parent.resolve()

    def _relativize(self, file_path: str) -> str:
        """将绝对路径转换为相对路径"""
        try:
            p = Path(file_path).resolve()
            return str(p.relative_to(self._project_root()).as_posix())
        except ValueError:
            return file_path

    def generate_reason_markdown(self, debug_mode: bool = False) -> Optional[str]:
        """
        生成诊断报告 Markdown。当存在 Error 或 Warning 时返回报告字符串，否则返回 None。
        """

        def debug_log(msg: str) -> None:
            if debug_mode:
                print(f"[DIAG_DEBUG] {msg}", file=sys.stderr)

        debug_log("开始诊断检查")

        # 智能等待：先等待3秒，然后检查文件是否更新
        debug_log("等待3秒让诊断文件稳定")
        time.sleep(3)

        # 如果诊断文件不存在，再等待2秒重新定位
        if not self.diagnostics_file or not self.diagnostics_file.exists():
            debug_log("诊断文件不存在，等待2秒后重新定位")
            time.sleep(2)
            self.diagnostics_file = self._locate_diagnostics_file()

        if self.diagnostics_file:
            debug_log(f"使用诊断文件: {self.diagnostics_file}")
        else:
            debug_log("未找到诊断文件")

        data = self.load_diagnostics()
        if not data:
            debug_log("诊断数据为空或加载失败")
            return None

        stats = self.analyze_statistics(data)
        errors = stats["by_severity"].get("Error", 0)
        warnings = stats["by_severity"].get("Warning", 0)

        debug_log(f"诊断统计: {errors}个错误, {warnings}个警告")

        # 如果没有 Error 或 Warning，静默
        if not errors and not warnings:
            debug_log("没有错误或警告，静默退出")
            return None

        debug_log("发现问题，生成详细报告")

        # 生成详细诊断报告
        detail_lines: List[str] = []

        for file_data in data:
            diagnostics = file_data.get("diagnostics", [])
            if not diagnostics:
                continue

            file_path = file_data["file"]
            file_name = Path(file_path).name

            # 按严重级别统计该文件的问题
            file_errors = sum(1 for d in diagnostics if d.get("severity") == 0)
            file_warnings = sum(1 for d in diagnostics if d.get("severity") == 1)
            file_infos = sum(1 for d in diagnostics if d.get("severity") == 2)
            file_hints = sum(1 for d in diagnostics if d.get("severity") == 3)

            # 生成文件摘要
            summary_parts = []
            if file_errors:
                summary_parts.append(f"{file_errors}个error")
            if file_warnings:
                summary_parts.append(f"{file_warnings}个warning")
            if file_infos:
                summary_parts.append(f"{file_infos}个information")
            if file_hints:
                summary_parts.append(f"{file_hints}个hint")
            summary_text = ", ".join(summary_parts)

            detail_lines.append(f"### 📄 {file_name} ({summary_text})")
            detail_lines.append("")

            # 生成该文件下每个诊断的详细信息
            for diagnostic in diagnostics:
                severity_name = self.SEVERITY_MAP.get(
                    diagnostic.get("severity", 0), "Unknown"
                )
                icon = self.SEVERITY_ICONS.get(severity_name, "📋")

                start = diagnostic.get("start", {})
                end = diagnostic.get("end", {})
                line = start.get("line", 0)
                start_char = start.get("character", 0)
                end_char = end.get("character", 0)

                detail_lines.append(
                    f"**第{line}行:{start_char}-{end_char}** - {icon} {severity_name}"
                )
                detail_lines.append(f"- **消息**: {diagnostic.get('message', '无')}")

                if diagnostic.get("source"):
                    detail_lines.append(f"- **来源**: {diagnostic['source']}")

                if diagnostic.get("code"):
                    detail_lines.append(f"- **错误代码**: {diagnostic['code']}")

                detail_lines.append(f"- **文件路径**: `{self._relativize(file_path)}`")
                detail_lines.append("")

        # 生成最终的 reason，包含摘要和详细信息
        header = [
            "### 诊断摘要",
            "",
            f"- ❌ Error: {errors}",
            f"- ⚠️ Warning: {warnings}",
            "",
        ]

        reason_md = "\n".join(header + detail_lines)
        return reason_md

    def check_and_report(self, debug_mode: bool = False) -> bool:
        """
        执行诊断检查并报告结果（PostToolUse 路径）。

        Returns:
            bool: True 如果发现 Error 或 Warning（应阻断流程），False 如果没有问题
        """

        reason_md = self.generate_reason_markdown(debug_mode)
        if not reason_md:
            return False

        # 输出阻断决策（PostToolUse 使用 reason 字段）
        print(
            json.dumps({"decision": "block", "reason": reason_md}, ensure_ascii=False)
        )
        return True


def get_hook_input() -> Dict[str, Any]:
    """
    多源输入获取：支持命令行参数、环境变量、stdin输入

    Returns:
        Dict[str, Any]: 钩子数据字典
    """
    # 设置命令行参数解析
    parser = argparse.ArgumentParser(
        description="Claude Code 集成钩子脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--event", type=str, help="钩子事件名称 (如: PostToolUse)")
    parser.add_argument("--debug", action="store_true", help="启用调试输出")

    args = parser.parse_args()

    # 调试信息输出
    def debug_log(msg: str) -> None:
        if args.debug:
            print(f"[DEBUG] {msg}", file=sys.stderr)

    debug_log(f"脚本启动，参数: {sys.argv}")

    # 方法1: 命令行参数
    if args.event:
        debug_log(f"使用命令行参数事件: {args.event}")
        return {"hook_event_name": args.event}

    # 方法2: 环境变量
    env_event = os.environ.get("CLAUDE_HOOK_EVENT")
    if env_event:
        debug_log(f"使用环境变量事件: {env_event}")
        return {"hook_event_name": env_event}

    # 方法3: stdin 输入（传统方式）
    try:
        debug_log("尝试从stdin读取输入")

        # 检查是否有可用的stdin
        if sys.stdin.isatty():
            debug_log("检测到交互式终端，没有stdin管道输入")
        else:
            input_data = sys.stdin.read().strip()
            debug_log(f"从stdin读取到数据长度: {len(input_data)}")

            if input_data:
                try:
                    normalized_input = normalize_paths_in_json(input_data)
                    data = json.loads(normalized_input)
                    debug_log(f"成功解析JSON: {data}")
                    return data
                except json.JSONDecodeError as e:
                    debug_log(f"JSON解析失败: {e}")
    except Exception as e:
        debug_log(f"stdin读取异常: {e}")

    # 方法4: 默认钩子事件（钩子环境检测）
    # 检测 Claude Code 钩子环境的多个指标
    claude_indicators = [
        os.environ.get("CLAUDE_PROJECT_DIR"),
        os.environ.get("CLAUDE_USER_ID"),
        os.environ.get("CLAUDE_SESSION_ID"),
        # 检查是否在 .claude 目录下执行
        ".claude" in str(Path(__file__).resolve()),
        # 检查进程名是否包含 claude
        any("claude" in arg.lower() for arg in sys.argv if isinstance(arg, str)),
    ]

    if any(claude_indicators):
        debug_log(f"检测到Claude环境指标: {[i for i in claude_indicators if i]}")
        debug_log("使用默认PostToolUse事件")
        return {"hook_event_name": "PostToolUse"}

    debug_log("所有输入方法都失败，使用Unknown事件")
    return {"hook_event_name": "Unknown"}


def main():
    """主调度逻辑"""
    # 确保 UTF-8 编码输出
    ensure_utf8_output()

    try:
        # 多源输入获取
        data = get_hook_input()
        hook_event_name = data.get("hook_event_name", "Unknown")

        # 条件分发逻辑
        if hook_event_name == "PostToolUse":
            # 获取调试模式参数
            debug_mode = (
                "--debug" in sys.argv
                or os.environ.get("CLAUDE_HOOK_DEBUG", "").lower() == "true"
            )

            # 执行诊断检查
            checker = DiagnosticsChecker()
            if not checker.check_and_report(debug_mode):
                # 没有问题时静默退出
                pass
        elif hook_event_name == "UserPromptSubmit":
            # 获取调试模式参数
            debug_mode = (
                "--debug" in sys.argv
                or os.environ.get("CLAUDE_HOOK_DEBUG", "").lower() == "true"
            )

            checker = DiagnosticsChecker()
            reason_md = checker.generate_reason_markdown(debug_mode)
            if reason_md:
                # 不阻断，仅将报告注入上下文 additionalContext（在开头加入优先级强调）
                emphasis = (
                    "⚠️ 优先级提示\n\n"
                    "请暂停当前任务与后续输出，先修复以下代码错误/警告，再继续原始任务。\n"
                    "建议执行顺序：\n"
                    "1) 逐个修复下列 Error（阻断项）\n"
                    "2) 处理 Warning（非阻断但建议修复）\n"
                    "3) 重新构建/分析，确认无 Error 后再回答最初的问题。\n\n"
                    "---\n\n"
                )
                injected = emphasis + reason_md
                out = {
                    "hookSpecificOutput": {
                        "hookEventName": "UserPromptSubmit",
                        "additionalContext": injected,
                    }
                }
                print(json.dumps(out, ensure_ascii=False))
            else:
                # 静默
                pass
        else:
            # 其他事件类型，输出事件名称
            try:
                print(f"{hook_event_name}：钩子触发")
            except UnicodeEncodeError:
                print(f"{hook_event_name}: Hook Triggered (Encoding Fallback)")

        sys.exit(0)

    except KeyboardInterrupt:
        sys.exit(130)
    except Exception as e:
        # 改进异常处理，提供更多上下文信息
        error_info = {
            "error_type": type(e).__name__,
            "error_message": str(e),
            "script_path": __file__,
            "argv": sys.argv,
            "env_vars": {
                "CLAUDE_PROJECT_DIR": os.environ.get("CLAUDE_PROJECT_DIR"),
                "CLAUDE_HOOK_EVENT": os.environ.get("CLAUDE_HOOK_EVENT"),
                "CLAUDE_HOOK_DEBUG": os.environ.get("CLAUDE_HOOK_DEBUG"),
            },
        }
        print(
            f"钩子脚本异常: {json.dumps(error_info, ensure_ascii=False, indent=2)}",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()