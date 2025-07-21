import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

// Shadcn UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Services and utilities
import { post, put, get } from "@/services/apiService";
import Validate from "@/lib/Handlevalidation";

// Define interfaces for API responses
interface StateData {
  id: number;
  stateName: string;
  createdAt: string;
  updatedAt: string;
}

// Create schema for state form
const stateFormSchema = z.object({
  stateName: z.string()
    .min(1, "State name is required")
    .max(255, "State name must not exceed 255 characters"),
});

// Helper to extract user-friendly message from API error
const prettifyFieldName = (key: string): string => {
  // Remove table prefix and suffix if present
  const parts = key.split("_");
  let field = parts.length > 1 ? parts[1] : key;
  // Remove trailing 'key' or 'id'
  field = field.replace(/(key|id)$/i, "");
  // Convert camelCase to spaced words
  field = field.replace(/([A-Z])/g, " $1").trim();
  // Capitalize first letter
  return field.charAt(0).toUpperCase() + field.slice(1);
};

const extractErrorMessage = (error: any): string | undefined => {
  if (error?.errors && typeof error.errors === "object") {
    const firstKey = Object.keys(error.errors)[0];
    if (firstKey) {
      const message = error.errors[firstKey]?.message as string | undefined;
      if (message) {
        const pretty = prettifyFieldName(firstKey);
        return message.replace(firstKey, pretty);
      }
    }
  }
  return error?.message;
};

interface StateFormProps {
  mode: "create" | "edit";
  stateId?: string;
  onSuccess?: () => void;
  className?: string;
}

const StateForm = ({
  mode,
  stateId,
  onSuccess,
  className,
}: StateFormProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initialize form with Shadcn Form
  const form = useForm<any>({
    resolver: zodResolver(stateFormSchema) as any,
    defaultValues: {
      stateName: "",
    },
  });

  // Query for fetching state data in edit mode
  const { data: stateData, isLoading: isFetchingState, error: fetchError } = useQuery({
    queryKey: ["state", stateId],
    queryFn: async (): Promise<StateData> => {
      if (!stateId) throw new Error("State ID is required");
      try {
        const response = await get(`/api/states/${stateId}`);
        return response;
      } catch (error) {
        console.error("Failed to fetch state data:", error);
        throw error;
      }
    },
    enabled: mode === "edit" && !!stateId,
    retry: false,
  });

  // Set form values when state data is loaded in edit mode
  useEffect(() => {
    if (stateData && mode === "edit") {
      form.reset({
        stateName: stateData.stateName || "",
      });
    }
  }, [stateData, mode, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return post("/api/states", data);
    },
    onSuccess: () => {
      toast.success("State created successfully!");
      queryClient.invalidateQueries({ queryKey: ["states"] });
      form.reset();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/states");
      }
    },
    onError: (error: any) => {
      console.error("Create state error:", error);
      const message = extractErrorMessage(error) || "Failed to create state";
      toast.error(message);
      Validate(error, form.setError);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      return put(`/api/states/${stateId}`, data);
    },
    onSuccess: () => {
      toast.success("State updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["states"] });
      queryClient.invalidateQueries({ queryKey: ["state", stateId] });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/states");
      }
    },
    onError: (error: any) => {
      console.error("Update state error:", error);
      const message = extractErrorMessage(error) || "Failed to update state";
      toast.error(message);
      Validate(error, form.setError);
    },
  });

  // Handle form submission
  const onSubmit = (data: any) => {
    if (mode === "create") {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      navigate("/states");
    }
  };

  const isFormLoading = createMutation.isPending || updateMutation.isPending || isFetchingState;

  // Show loading while fetching state data in edit mode
  if (mode === "edit" && isFetchingState) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading state data...</span>
      </div>
    );
  }

  // Show error if failed to fetch state data
  if (mode === "edit" && fetchError) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Failed to load state data</p>
        <Button variant="outline" onClick={() => navigate("/states")} className="mt-2">
          Back to States
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* State Name Field */}
          <FormField
            control={form.control}
            name="stateName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter state name"
                    {...field}
                    disabled={isFormLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Form Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isFormLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isFormLoading}>
              {isFormLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create" : "Update"} State
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default StateForm;
