import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalProps {
  title: React.ReactNode;
  children: React.ReactNode;
  close: () => void;
}

const Modal: React.FC<ModalProps> = ({ title, children, close }) => {
  const onPointerDownOutside = (e) => {
    e.preventDefault();
  };

  return (
    <Dialog defaultOpen>
      <DialogContent onPointerDownOutside={onPointerDownOutside}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{children}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="submit" onClick={close}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
