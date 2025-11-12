import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "@/lib/user";
import { signOut } from "@/lib/user/actions";
import { ChevronDown } from "lucide-react";

interface Props {
  user: User
}

const Profile: React.FC<Props> = ({ user }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex gap-1 items-center">
        <Avatar className="shadow bg-white">
          <AvatarImage src={user.profilePicture} />
        </Avatar>
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="text-xs text-muted-foreground">Signed in as </span>
          <span className="font-medium">{user.username}</span>
          <br />
          <span className="text-xs text-muted-foreground">Balance: </span>
          <span className="font-medium">{user.money}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default Profile;
