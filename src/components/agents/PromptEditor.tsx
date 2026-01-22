import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Wand2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PromptEditorProps {
  systemPrompt: string;
  firstMessage: string;
  onSystemPromptChange: (value: string) => void;
  onFirstMessageChange: (value: string) => void;
  language?: string;
  organizationId?: string;
}

interface Suggestion {
  category: string;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export function PromptEditor({
  systemPrompt,
  firstMessage,
  onSystemPromptChange,
  onFirstMessageChange,
  language = 'fr',
  organizationId,
}: PromptEditorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [improvedPrompt, setImprovedPrompt] = useState<string>('');
  const [improvedFirstMessage, setImprovedFirstMessage] = useState<string>('');

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('improve-prompt', {
        body: {
          action: 'analyze_and_suggest',
          currentPrompt: systemPrompt,
          currentFirstMessage: firstMessage,
          language,
          organizationId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      return data.suggestions as Suggestion[];
    },
    onSuccess: (data) => {
      setSuggestions(data);
      setShowSuggestions(true);
    },
    onError: (error: Error) => {
      toast.error(`Failed to analyze prompt: ${error.message}`);
    },
  });

  const improveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('improve-prompt', {
        body: {
          action: 'quick_improve',
          currentPrompt: systemPrompt,
          currentFirstMessage: firstMessage,
          language,
          organizationId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Improvement failed');

      return {
        improvedPrompt: data.improvedPrompt,
        improvedFirstMessage: data.improvedFirstMessage,
      };
    },
    onSuccess: (data) => {
      setImprovedPrompt(data.improvedPrompt || systemPrompt);
      setImprovedFirstMessage(data.improvedFirstMessage || firstMessage);
      setShowSuggestions(true);
    },
    onError: (error: Error) => {
      toast.error(`Failed to improve prompt: ${error.message}`);
    },
  });

  const handleApplyImproved = () => {
    if (improvedPrompt) {
      onSystemPromptChange(improvedPrompt);
    }
    if (improvedFirstMessage) {
      onFirstMessageChange(improvedFirstMessage);
    }
    setShowSuggestions(false);
    toast.success('Improved prompt applied!');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="systemPrompt" className="text-base font-medium">
            System Prompt
          </Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending || !systemPrompt.trim()}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Analyze
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => improveMutation.mutate()}
              disabled={improveMutation.isPending || !systemPrompt.trim()}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              {improveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Improve with AI
            </Button>
          </div>
        </div>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          placeholder="You are a helpful assistant that..."
          className="min-h-[200px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Define the personality, behavior, and capabilities of your agent.
        </p>
      </div>

      {/* First Message */}
      <div className="space-y-2">
        <Label htmlFor="firstMessage" className="text-base font-medium">
          First Message
        </Label>
        <Textarea
          id="firstMessage"
          value={firstMessage}
          onChange={(e) => onFirstMessageChange(e.target.value)}
          placeholder="Hello! How can I help you today?"
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          The greeting message your agent will use to start conversations.
        </p>
      </div>

      {/* Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Prompt Suggestions
            </DialogTitle>
            <DialogDescription>
              Review the AI analysis and improvements for your prompt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Suggestions List */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Analysis Results</h4>
                {suggestions.map((suggestion, idx) => (
                  <Card key={idx} className="border-l-4" style={{
                    borderLeftColor: suggestion.priority === 'high' ? 'hsl(var(--destructive))' : 
                                     suggestion.priority === 'medium' ? 'hsl(var(--warning))' : 
                                     'hsl(var(--muted))'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-xs', getPriorityColor(suggestion.priority))}>
                              {suggestion.category}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{suggestion.issue}</p>
                          <p className="text-sm">{suggestion.suggestion}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Improved Prompt Preview */}
            {improvedPrompt && (
              <div className="space-y-3">
                <h4 className="font-medium">Improved System Prompt</h4>
                <Card>
                  <CardContent className="p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md">
                      {improvedPrompt}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            {improvedFirstMessage && (
              <div className="space-y-3">
                <h4 className="font-medium">Improved First Message</h4>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm bg-muted/50 p-3 rounded-md">
                      {improvedFirstMessage}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestions(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            {improvedPrompt && (
              <Button onClick={handleApplyImproved}>
                <Check className="mr-2 h-4 w-4" />
                Apply Improvements
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
